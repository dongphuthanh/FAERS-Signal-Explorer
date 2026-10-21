// One stack: network, database, bucket, secrets, the web service, alarms.
//
//   npx cdk diff   --profile faers
//   npx cdk deploy --profile faers -c alertEmail=you@example.com
//   npx cdk deploy --profile faers -c restore=true      (adds the temporary restore box)
import { App, Tags } from 'aws-cdk-lib';
import { FaersStack } from '../lib/faers-stack.mjs';

const app = new App();
new FaersStack(app, 'Faers', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  description: 'FAERS Signal Explorer: App Runner + RDS PostgreSQL/pgvector',
  alertEmail: app.node.tryGetContext('alertEmail'),
  restoreBox: String(app.node.tryGetContext('restore')) === 'true',
  model: app.node.tryGetContext('model') ?? 'claude-sonnet-5',
});
Tags.of(app).add('project', 'faers-signal-explorer');
