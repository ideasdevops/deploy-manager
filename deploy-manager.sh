#!/bin/bash

# Deploy Manager Launcher
echo "🚀 Deploy Manager - Panel de Control"
echo "=================================="

# Check if running
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Deploy Manager ya está corriendo"
    
    # Find the port
    PORT=$(ps aux | grep "node.*server.js" | grep -o 'PORT=[0-9]*' | head -1 | cut -d= -f2)
    if [ -z "$PORT" ]; then
        PORT=3001
    fi
    
    echo "🌐 Accede a: http://localhost:$PORT"
    echo ""
    echo "Opciones:"
    echo "  1. Abrir en navegador"
    echo "  2. Ver logs"
    echo "  3. Detener"
    echo "  4. Salir"
    echo ""
    read -p "Selecciona una opción [1-4]: " choice
    
    case $choice in
        1)
            xdg-open http://localhost:$PORT 2>/dev/null || echo "No se pudo abrir el navegador automáticamente"
            ;;
        2)
            cd /home/franco/deploy-manager
            if [ -f "logs/startup.log" ]; then
                tail -f logs/startup.log
            else
                echo "No se encontraron logs"
            fi
            ;;
        3)
            cd /home/franco/deploy-manager
            ./stop.sh
            ;;
        4)
            exit 0
            ;;
        *)
            echo "Opción no válida"
            ;;
    esac
else
    echo "🔄 Iniciando Deploy Manager..."
    cd /home/franco/deploy-manager
    
    # Find available port (prefer 3001)
    if ! ss -tlnp | grep -q :3001; then
        PORT=3001
    elif ! ss -tlnp | grep -q :3002; then
        PORT=3002
    elif ! ss -tlnp | grep -q :3003; then
        PORT=3003
    else
        PORT=3001
    fi

    echo "🌐 Iniciando en puerto $PORT..."
    PORT=$PORT ./start.sh
    
    echo ""
    echo "✅ Deploy Manager iniciado!"
    echo "🌐 Accede a: http://localhost:$PORT"
    
    # Offer to open browser
    read -p "¿Abrir en navegador? [S/n]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        sleep 2
        xdg-open http://localhost:$PORT 2>/dev/null || echo "No se pudo abrir el navegador automáticamente"
    fi
fi

echo ""
echo "💡 Para más opciones, ejecuta:"
echo "   ./start.sh   - Iniciar servicio"
echo "   ./stop.sh    - Detener servicio"
echo "   ./setup.sh  - Configurar"