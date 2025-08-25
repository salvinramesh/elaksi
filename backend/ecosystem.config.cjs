cat > /var/www/elaksi/backend/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: "elaksi-backend",
      script: "src/server.js",
      cwd: "/var/www/elaksi/backend",
      env: { NODE_ENV: "production" },
      error_file: "/var/log/elaksi-backend.err.log",
      out_file: "/var/log/elaksi-backend.out.log",
      time: true,
      watch: false,
      instances: 1,
      autorestart: true
    }
  ]
}
EOF
