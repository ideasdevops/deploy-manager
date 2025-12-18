const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const portscanner = require('portscanner');
const si = require('systeminformation');

// Función para obtener procesos compatible
const psList = {
  async getProcesses() {
    return new Promise((resolve, reject) => {
      exec('ps aux', (error, stdout, stderr) => {
        if (error) {
          reject(new Error(error));
          return;
        }
        
        const lines = stdout.trim().split('\n').slice(1);
        const processes = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 11) return null;
          
          return {
            pid: parseInt(parts[1]),
            name: parts[10].split('/').pop() || parts[10],
            cmd: parts.slice(10).join(' '),
            cpu: parseFloat(parts[2]) || 0,
            memory: parseFloat(parts[3]) || 0,
            pcpu: parseFloat(parts[2]) || 0,
            pmem: parseFloat(parts[3]) || 0,
            memRss: parseInt(parts[5]) || 0
          };
        }).filter(Boolean);
        
        resolve(processes);
      });
    });
  }
};

// Importar servicios
const ProjectService = require('./services/ProjectService');
const SystemMonitor = require('./services/SystemMonitor');
const LogManager = require('./services/LogManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let PORT;
try {
  const configPath = path.join(__dirname, 'config', 'config.json');
  const config = fs.existsSync(configPath) ? fs.readJsonSync(configPath) : null;
  PORT = process.env.PORT || (config && config.server && config.server.port) || 3001;
} catch (err) {
  PORT = process.env.PORT || 3001;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Servicios
const projectService = new ProjectService();
const systemMonitor = new SystemMonitor();
const logManager = new LogManager();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  // Enviar estado inicial
  socket.emit('initial-data', {
    projects: projectService.getAllProjects(),
    systemInfo: systemMonitor.getCurrentInfo(),
    logs: logManager.getRecentLogs()
  });
  
  // Manejar eventos de control de proyectos
  socket.on('start-project', async (projectId) => {
    try {
      const result = await projectService.startProject(projectId);
      io.emit('project-status', { projectId, status: result });
      logManager.addLog(`info`, `Proyecto ${projectId} iniciado: ${result.message}`);
    } catch (error) {
      io.emit('project-status', { projectId, status: 'error', error: error.message });
      logManager.addLog('error', `Error iniciando ${projectId}: ${error.message}`);
    }
  });
  
  socket.on('stop-project', async (projectId) => {
    try {
      const result = await projectService.stopProject(projectId);
      io.emit('project-status', { projectId, status: result });
      logManager.addLog(`info`, `Proyecto ${projectId} detenido: ${result.message}`);
    } catch (error) {
      io.emit('project-status', { projectId, status: 'error', error: error.message });
      logManager.addLog('error', `Error deteniendo ${projectId}: ${error.message}`);
    }
  });
  
  socket.on('restart-project', async (projectId) => {
    try {
      const result = await projectService.restartProject(projectId);
      io.emit('project-status', { projectId, status: result });
      logManager.addLog(`info`, `Proyecto ${projectId} reiniciado: ${result.message}`);
    } catch (error) {
      io.emit('project-status', { projectId, status: 'error', error: error.message });
      logManager.addLog('error', `Error reiniciando ${projectId}: ${error.message}`);
    }
  });
  
  socket.on('get-project-logs', (projectId) => {
    const logs = logManager.getProjectLogs(projectId);
    socket.emit('project-logs', { projectId, logs });
  });
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// API Routes
app.get('/api/projects', (req, res) => {
  res.json(projectService.getAllProjects());
});

app.get('/api/projects/:id/status', async (req, res) => {
  try {
    const status = await projectService.getProjectStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/start', async (req, res) => {
  try {
    const result = await projectService.startProject(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/stop', async (req, res) => {
  try {
    const result = await projectService.stopProject(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/info', async (req, res) => {
  try {
    const info = await systemMonitor.getDetailedInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs', (req, res) => {
  res.json(logManager.getRecentLogs());
});

app.get('/api/logs/:projectId', (req, res) => {
  res.json(logManager.getProjectLogs(req.params.projectId));
});

// Iniciar monitoreo del sistema
setInterval(async () => {
  const systemInfo = await systemMonitor.getCurrentInfo();
  io.emit('system-update', systemInfo);
}, 5000);

// Iniciar verificación de proyectos
setInterval(async () => {
  const projectStatuses = await projectService.getAllProjectsStatus();
  io.emit('projects-status-update', projectStatuses);
}, 10000);

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Deploy Manager iniciado en http://localhost:${PORT}`);
  console.log(`📊 Panel de control: http://localhost:${PORT}`);
  console.log(`🔧 Servicios detectados: ${projectService.getProjectsCount()}`);
});

module.exports = { app, server, io };