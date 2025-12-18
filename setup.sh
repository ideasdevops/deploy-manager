#!/bin/bash

# Setup script for Deploy Manager
echo "🚀 Configurando Deploy Manager..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor, instala Node.js 16+ primero."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado. Por favor, instala npm primero."
    exit 1
fi

echo "✅ Node.js y npm detectados"

# Install dependencies
echo "📦 Instalando dependencias..."
npm install

# Create necessary directories
echo "📁 Creando directorios..."
mkdir -p logs
mkdir -p config

# Set permissions for scripts
chmod +x start.sh
chmod +x stop.sh

echo "✅ Configuración completada!"
echo ""
echo "🎯 Para iniciar el gestor:"
echo "   npm start"
echo ""
echo "🌐 Accede a: http://localhost:3001"
echo ""
echo "📚 Proyectos detectados:"
ls -la /media/franco/datos-bkp/SELF-HOSTED/ | grep '^d' | awk '{print "   • " $9}' | grep -v '^\.$' | sort