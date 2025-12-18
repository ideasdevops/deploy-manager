#!/bin/bash

# Stop script for Deploy Manager
echo "🛑 Deteniendo Deploy Manager..."

# Get PID from file
if [ -f ".deploy-manager.pid" ]; then
    PID=$(cat .deploy-manager.pid)
    
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "🔄 Deteniendo servidor (PID: $PID)..."
        kill "$PID"
        
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! ps -p "$PID" > /dev/null 2>&1; then
                echo "✅ Deploy Manager detenido correctamente"
                rm -f .deploy-manager.pid
                exit 0
            fi
            sleep 1
        done
        
        # Force kill if still running
        echo "⚠️ Forzando detención..."
        kill -9 "$PID" 2>/dev/null
        rm -f .deploy-manager.pid
        echo "✅ Deploy Manager detenido"
    else
        echo "❌ No se encontró proceso corriendo con PID: $PID"
        rm -f .deploy-manager.pid
    fi
else
    echo "❌ No se encontró archivo .deploy-manager.pid"
    echo "🔍 Buscando procesos manualmente..."
    
    # Try to find and kill manually
    PIDS=$(pgrep -f "node.*server.js")
    if [ -n "$PIDS" ]; then
        echo "🔄 Deteniendo procesos: $PIDS"
        echo "$PIDS" | xargs kill
        echo "✅ Procesos detenidos"
    else
        echo "ℹ️ No se encontraron procesos de Deploy Manager corriendo"
    fi
fi