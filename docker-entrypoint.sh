#!/bin/sh
# Automatically parse single DATABASE_URL secret variable into n8n's DB_POSTGRESDB_* environment variables at startup
if [ -n "$DATABASE_URL" ]; then
  eval $(node -e '
    try {
      const u = new URL(process.env.DATABASE_URL);
      console.log("export DB_TYPE=postgresdb");
      console.log("export DB_POSTGRESDB_HOST=" + JSON.stringify(u.hostname));
      console.log("export DB_POSTGRESDB_PORT=" + JSON.stringify(u.port || "5432"));
      console.log("export DB_POSTGRESDB_DATABASE=" + JSON.stringify(u.pathname.replace(/^\//, "") || "postgres"));
      console.log("export DB_POSTGRESDB_USER=" + JSON.stringify(decodeURIComponent(u.username)));
      console.log("export DB_POSTGRESDB_PASSWORD=" + JSON.stringify(decodeURIComponent(u.password)));
      console.log("export DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false");
    } catch(e) {}
  ')
fi

exec "$@"
