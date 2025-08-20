#!/bin/bash
# Script to push database schema with automatic responses

# Install expect if not present
which expect > /dev/null || apt-get update && apt-get install -y expect

# Create expect script
cat > db_push_expect.exp << 'EOF'
#!/usr/bin/expect -f
spawn npm run db:push
expect "Is attendance_records table created or renamed from another table?"
send "+ attendance_records\r"
expect "Done in"
EOF

chmod +x db_push_expect.exp
expect db_push_expect.exp