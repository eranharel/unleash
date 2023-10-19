'use strict';

exports.up = function (db, cb) {
    db.runSql(
        `
            INSERT INTO environments(name, type, enabled, sort_order)
            VALUES ('development', 'development', true, 100),
                   ('test', 'test', true, 200),
                   ('staging', 'staging', true, 300),
                   ('production', 'production', true, 400);
        `,
        cb,
    );
};

exports.down = function (db, cb) {
    db.runSql(
        `
        DELETE
        FROM environments
        WHERE name IN ('development', 'production', 'test', 'staging');
    `,
        cb,
    );
};
