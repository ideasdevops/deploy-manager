# Deploy Manager

Herramienta centralizada para gestionar el despliegue de proyectos locales self-hosted.

## Características

- 🚀 Inicio/parada de servicios con un click
- 📊 Monitoreo de recursos y estado en tiempo real
- 🔧 Configuración individual por proyecto
- 📋 Logs centralizados
- 🌐 Interfaz web intuitiva
- 🔄 Detección automática de proyectos

## Proyectos Soportados

### Bajos Requisitos de GPU ✅
- **Video Text Editor** - Edición de video por transcripción
- **Penpot** - Herramienta de diseño (Figma alternativa)
- **Open-Cut** - Editor de video privacy-focused
- **SISGEC** - Sistema médico de registros clínicos

### Configurables ⚠️
- **Biniou** - Multi-generador AI (CPU/GPU selectable)

## Instalación

```bash
cd /home/franco/deploy-manager
npm install
npm run setup
PORT=3001 npm start
```

## Uso

1. Accede a `http://localhost:3001`
2. Los proyectos se detectan automáticamente desde `/media/franco/datos-bkp/SELF-HOSTED`
3. Usa los controles para iniciar/detener servicios
4. Monitoriza recursos y logs en tiempo real

## Configuración

Cada proyecto tiene su archivo de configuración en `config/projects/`. Puedes personalizar:
- Puertos
- Comandos de inicio/parada
- Requisitos de sistema
- Variables de entorno

## Estructura

```
deploy-manager/
├── server.js              # Servidor principal
├── public/                # Frontend
├── config/               # Configuraciones
├── services/             # Lógica de servicios
├── logs/                # Logs centralizados
└── package.json
```