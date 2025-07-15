#!/bin/bash
# Backup script for Viveo

BACKUP_DIR="/tmp/viveo_backup"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Check if .env file exists
if [[ ! -f .env ]]; then
    echo "ERROR: .env file not found"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Find MySQL container
MYSQL_CONTAINER=$(docker ps --filter "name=mysql" --format "{{.Names}}" | head -1)

if [[ -n "$MYSQL_CONTAINER" ]]; then
    # Backup database
    echo "Backing up database..."
    docker exec $MYSQL_CONTAINER mysqldump -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE:-viveo_db} > $BACKUP_DIR/db_backup_$DATE.sql 2>/dev/null || echo "Database backup failed"
else
    echo "MySQL container not found, skipping database backup"
fi

# Backup data directory if it exists
if [[ -d data/ ]]; then
    echo "Backing up data directory..."
    tar -czf $BACKUP_DIR/data_backup_$DATE.tar.gz data/ 2>/dev/null || echo "Data backup failed"
fi

# Backup environment
cp .env $BACKUP_DIR/env_backup_$DATE 2>/dev/null || echo "Environment backup failed"

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*backup*" -mtime +7 -delete 2>/dev/null || true

echo "Backup completed: $DATE"
echo "Backup location: $BACKUP_DIR"
