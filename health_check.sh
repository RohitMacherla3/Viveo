#!/bin/bash
# Simple health check script for Viveo

# Get running container names
SERVICES=$(docker ps --format "{{.Names}}" | grep viveo || echo "")
ALERT_EMAIL=""  # Set your email here

if [[ -z "$SERVICES" ]]; then
    echo "ALERT: No Viveo services are running"
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "ALERT: No Viveo services are running" | mail -s "Viveo Service Alert" $ALERT_EMAIL
    fi
    exit 1
fi

for service in $SERVICES; do
    if ! docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
        echo "ALERT: $service is not running"
        if [[ -n "$ALERT_EMAIL" ]]; then
            echo "ALERT: $service is not running" | mail -s "Viveo Service Alert" $ALERT_EMAIL
        fi
        # Try to restart the service
        docker start $service 2>/dev/null || true
    fi
done

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -gt 80 ]]; then
    echo "ALERT: Disk usage is ${DISK_USAGE}%"
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "ALERT: Disk usage is ${DISK_USAGE}%" | mail -s "Viveo Disk Alert" $ALERT_EMAIL
    fi
fi

# Cleanup old logs
docker system prune -f >/dev/null 2>&1 || true
find logs/ -name "*.log" -mtime +7 -delete 2>/dev/null || true
