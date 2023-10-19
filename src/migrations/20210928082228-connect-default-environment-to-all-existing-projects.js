const async = require('async');
exports.up = function (db, cb) {
    async.series(
        [
            db.runSql.bind(db,
                `
                    INSERT INTO project_environments(project_id, environment_name)
                    SELECT id, 'default'
                    FROM projects
                    ON CONFLICT DO NOTHING;
                `,
            ),
            db.runSql.bind(db,
                `
                INSERT INTO project_environments(project_id, environment_name)
                SELECT projects.id, environments.name
                FROM projects, environments
                WHERE projects.id <> 'default'
                ON CONFLICT DO NOTHING;
                `,
                cb,
            )
        ],
        cb,
    )

};

exports.down = function (db, cb) {
    db.runSql(
        `
        DELETE
        FROM project_environments
        WHERE environment_name = 'default';
    `,
        cb,
    );
};
