import { pool } from '../src/db.mjs';


const [ingredient, rolesArg = 'PS,SS'] = process.argv.slice(2);
const roles = rolesArg.split(',');
if (!ingredient) {
    console.log(`please enter the ingredient`);
    process.exit(1);
}

try {
    const { rows } = await pool.query(`
            select r.pt, count(distinct d.caseid)::int as cases
            from raw_demo d
            join raw_drug g on g.primaryid = d.primaryid
            join raw_reac r on r.primaryid = d.primaryid
            where g.prod_ai = $1
            and g.role_cod = any($2)
            group by r.pt
            order by cases desc
            limit 10;
        `, [ingredient, roles]);
    console.table(rows);
} catch(error) {
    console.log(error);
}

await pool.end();