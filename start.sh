#!/bin/bash

# Start script for Deploy Manager
echo "🚀 Iniciando Deploy Manager..."

# Check if the service is already running
if pgrep -f "node.*server.js" > /dev/null; then
    echo "⚠️ Deploy Manager ya está corriendo"
    if [ -z "$PORT" ]; then
        PORT=3001
    fi
    echo "🌐 Accede a: http://localhost:$PORT"
    exit 0
fi

# Start the service
cd /home/franco/deploy-manager

if [ -z "$PORT" ]; then
    PORT=3001
fi

echo "📊 Iniciando servidor en puerto $PORT..."
PORT=$PORT nohup npm start > logs/startup.log 2>&1 &
PID=$!

# Save PID for later use
echo $PID > .deploy-manager.pid

echo "✅ Deploy Manager iniciado (PID: $PID)"
echo "🌐 Accede a: http://localhost:$PORT"
echo "📋 Logs disponibles en: logs/startup.log"
echo ""
echo "Para detener el servicio:"
echo "  ./stop.sh"
echo ""
echo "Para ver logs en tiempo real:"
echo "  tail -f logs/startup.log"