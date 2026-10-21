// The whole deployment.
//
//   internet ──HTTPS──► App Runner (the Docker image from ../Dockerfile)
//                          │ VPC connector, private subnets
//                          ▼
//                       RDS PostgreSQL 16 + pgvector (isolated subnets)
//
// Secrets Manager holds the DB credentials, the Anthropic key and the demo
// password; App Runner injects them as environment variables. S3 is the raw
// layer (FAERS zips, DailyMed XML) and carries the pg_dump that seeds RDS.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Stack, Duration, RemovalPolicy, CfnOutput, IgnoreMode } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVICE_NAME = 'faers-signal-explorer';

export class FaersStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ---- network ----
    // public: only the NAT gateway. app: the App Runner connector and the restore
    // box, outbound through NAT (the Anthropic API). db: no route out at all.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'app', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'db', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    // S3 traffic (the 5 GB restore) skips the NAT gateway and its per-GB charge
    vpc.addGatewayEndpoint('S3', { service: ec2.GatewayVpcEndpointAwsService.S3 });

    // ---- raw layer ----
    // RETAIN: tearing the stack down between demos keeps the data and the dump.
    const bucket = new s3.Bucket(this, 'Data', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // ---- database ----
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc, allowAllOutbound: false,
      description: 'Postgres: reachable only from the app connector and the restore box',
    });
    const engine = rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 });
    // Same reason as docker-compose.yml: at the 4 MB default the signal query's
    // distinct over millions of rows spills to disk. 128 MB (in kB).
    const params = new rds.ParameterGroup(this, 'DbParams', { engine, parameters: { work_mem: '131072' } });
    const db = new rds.DatabaseInstance(this, 'Db', {
      engine,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      databaseName: 'faers',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      parameterGroup: params,
      backupRetention: Duration.days(7),
      cloudwatchLogsExports: ['postgresql'],
      deletionProtection: false,
      removalPolicy: RemovalPolicy.SNAPSHOT,   // destroy leaves a final snapshot to restore from
    });

    // ---- app secrets ----
    // Created with random values. Set the real Anthropic key in the console
    // (Secrets Manager -> Retrieve/Edit secret value); later deploys keep it.
    const anthropicKey = new secretsmanager.Secret(this, 'AnthropicKey', {
      description: 'ANTHROPIC_API_KEY for the FAERS app. Replace the generated value with the real key.',
      generateSecretString: { passwordLength: 32, excludePunctuation: true },
    });
    const demoPassword = new secretsmanager.Secret(this, 'DemoPassword', {
      description: 'DEMO_PASSWORD (HTTP basic auth) for the FAERS app',
      generateSecretString: { passwordLength: 20, excludePunctuation: true },
    });

    // ---- the web service ----
    const image = new DockerImageAsset(this, 'Image', {
      directory: repoRoot,
      platform: Platform.LINUX_AMD64,
      ignoreMode: IgnoreMode.DOCKER,          // the allowlist in ../.dockerignore
    });

    // App Runner pulls the image with one role and runs the container with another
    const accessRole = new iam.Role(this, 'EcrAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
    });
    image.repository.grantPull(accessRole);
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });
    for (const s of [db.secret, anthropicKey, demoPassword]) s.grantRead(instanceRole);

    const appSg = new ec2.SecurityGroup(this, 'AppSg', { vpc, description: 'App Runner VPC connector' });
    dbSg.addIngressRule(appSg, ec2.Port.tcp(5432), 'app');
    const connector = new apprunner.CfnVpcConnector(this, 'Connector', {
      subnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
      securityGroups: [appSg.securityGroupId],
    });

    // Exactly one instance: the daily question cap lives in the process, so a
    // second instance would double it.
    const scaling = new apprunner.CfnAutoScalingConfiguration(this, 'OneInstance', {
      autoScalingConfigurationName: 'faers-one-instance',
      minSize: 1, maxSize: 1, maxConcurrency: 50,
    });

    const service = new apprunner.CfnService(this, 'Service', {
      serviceName: SERVICE_NAME,
      sourceConfiguration: {
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageRepositoryType: 'ECR',
          imageIdentifier: image.imageUri,
          imageConfiguration: {
            port: '8080',
            runtimeEnvironmentVariables: [
              { name: 'CLAUDE_MODEL', value: props.model },
              { name: 'DEMO_DAILY_CAP', value: '60' },
            ],
            runtimeEnvironmentSecrets: [
              { name: 'DB_SECRET', value: db.secret.secretArn },
              { name: 'ANTHROPIC_API_KEY', value: anthropicKey.secretArn },
              { name: 'DEMO_PASSWORD', value: demoPassword.secretArn },
            ],
          },
        },
      },
      instanceConfiguration: { cpu: '1 vCPU', memory: '2 GB', instanceRoleArn: instanceRole.roleArn },
      networkConfiguration: {
        egressConfiguration: { egressType: 'VPC', vpcConnectorArn: connector.attrVpcConnectorArn },
        ingressConfiguration: { isPubliclyAccessible: true },
      },
      healthCheckConfiguration: { protocol: 'HTTP', path: '/health', interval: 10, timeout: 5, healthyThreshold: 1, unhealthyThreshold: 5 },
      autoScalingConfigurationArn: scaling.attrAutoScalingConfigurationArn,
    });
    // the roles' policies (not just the roles) must exist before App Runner pulls and starts
    service.node.addDependency(accessRole, instanceRole);

    // ---- temporary restore box (cdk deploy -c restore=true; redeploy without it to remove) ----
    // No SSH and no open port: reached with SSM Session Manager. Pulls the dump
    // from S3 and runs pg_restore into RDS.
    if (props.restoreBox) {
      const boxSg = new ec2.SecurityGroup(this, 'RestoreSg', { vpc, description: 'temporary restore box' });
      dbSg.addIngressRule(boxSg, ec2.Port.tcp(5432), 'restore box');
      const box = new ec2.Instance(this, 'RestoreBox', {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroup: boxSg,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
        machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
        ssmSessionPermissions: true,
        requireImdsv2: true,
        blockDevices: [{ deviceName: '/dev/xvda', volume: ec2.BlockDeviceVolume.ebs(30, { encrypted: true }) }],
      });
      box.userData.addCommands('dnf install -y postgresql16 jq');
      bucket.grantRead(box);
      db.secret.grantRead(box);
      new CfnOutput(this, 'RestoreBoxId', { value: box.instanceId });
    }

    // ---- alarms ----
    const topic = new sns.Topic(this, 'Alerts');
    if (props.alertEmail) topic.addSubscription(new subs.EmailSubscription(props.alertEmail));
    const alarm = (id, description, metric, threshold, comparisonOperator) => {
      const a = new cloudwatch.Alarm(this, id, {
        alarmDescription: description, metric, threshold, evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        ...(comparisonOperator && { comparisonOperator }),
      });
      a.addAlarmAction(new cwActions.SnsAction(topic));
    };
    alarm('App5xx', 'the app returned 5xx responses',
      new cloudwatch.Metric({
        namespace: 'AWS/AppRunner', metricName: '5xxStatusResponses',
        dimensionsMap: { ServiceName: SERVICE_NAME, ServiceID: service.attrServiceId },
        statistic: 'Sum', period: Duration.minutes(5),
      }), 5);
    alarm('DbCpu', 'database CPU above 80% for 15 minutes',
      db.metricCPUUtilization({ period: Duration.minutes(15) }), 80);
    alarm('DbStorage', 'database free storage below 2 GB',
      db.metricFreeStorageSpace({ period: Duration.minutes(15) }), 2 * 1024 ** 3,
      cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD);

    // ---- outputs ----
    new CfnOutput(this, 'Url', { value: `https://${service.attrServiceUrl}` });
    new CfnOutput(this, 'ServiceArn', { value: service.attrServiceArn });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new CfnOutput(this, 'DbSecretArn', { value: db.secret.secretArn });
    new CfnOutput(this, 'AnthropicKeySecret', { value: anthropicKey.secretName });
    new CfnOutput(this, 'DemoPasswordSecret', { value: demoPassword.secretName });
  }
}
