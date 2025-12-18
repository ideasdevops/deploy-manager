const fs = require('fs');
const path = require('path');

class LogManager {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/deploy-manager.log');
    this.projectLogs = new Map();
    this.maxLogs = 1000;
    this.maxProjectLogs = 500;
    this.initialize();
  }

  async initialize() {
    // Asegurar que el directorio de logs exista
    try {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
      
      // Inicializar logs de proyectos
      const projectsConfig = this.getProjectsConfig();
      for (const projectId of Object.keys(projectsConfig)) {
        const projectLogPath = path.join(__dirname, '../logs', `${projectId}.log`);
        fs.mkdirSync(path.dirname(projectLogPath), { recursive: true });
        
        try {
          const existingLogs = fs.readFileSync(projectLogPath, 'utf8');
          const logs = existingLogs
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              try {
                return JSON.parse(line);
              } catch {
                return null;
              }
            })
            .filter(log => log)
            .slice(-this.maxProjectLogs);
          
          this.projectLogs.set(projectId, logs);
        } catch (error) {
          this.projectLogs.set(projectId, []);
        }
      }
    } catch (error) {
      console.error('Error inicializando LogManager:', error);
    }
  }

  getProjectsConfig() {
    try {
      const configPath = path.join(__dirname, '../config/projects.json');
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      return {};
    }
  }

  async addLog(level, message, projectId = null, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      projectId,
      metadata
    };

    // Escribir al archivo principal
    await this.writeToFile(this.logFile, logEntry);

    // Si es de un proyecto específico, escribir a su archivo
    if (projectId) {
      const projectLogPath = path.join(__dirname, '../logs', `${projectId}.log`);
      await this.writeToFile(projectLogPath, logEntry);
      
      // Actualizar logs en memoria
      const projectLogs = this.projectLogs.get(projectId) || [];
      projectLogs.push(logEntry);
      
      // Mantener límite de logs
      if (projectLogs.length > this.maxProjectLogs) {
        projectLogs.splice(0, projectLogs.length - this.maxProjectLogs);
      }
      
      this.projectLogs.set(projectId, projectLogs);
    }

    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  async writeToFile(filePath, logEntry) {
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(filePath, logLine);
      
      // Rotar logs si el archivo es muy grande (>10MB)
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 10 * 1024 * 1024) {
          const backupPath = filePath.replace('.log', '.old.log');
          fs.renameSync(filePath, backupPath);
          fs.writeFileSync(filePath, logLine);
        }
      } catch (statError) {
        // Si el archivo no existe, lo creamos
        if (statError.code === 'ENOENT') {
          fs.writeFileSync(filePath, logLine);
        }
      }
    } catch (error) {
      console.error('Error escribiendo log:', error);
    }
  }

  getRecentLogs(count = 100) {
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const logs = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(log => log)
        .slice(-count);
      
      return logs;
    } catch (error) {
      console.error('Error leyendo logs recientes:', error);
      return [];
    }
  }

  getProjectLogs(projectId, count = 100) {
    const logs = this.projectLogs.get(projectId) || [];
    return logs.slice(-count);
  }

  async clearLogs(projectId = null) {
    if (projectId) {
      const projectLogPath = path.join(__dirname, '../logs', `${projectId}.log`);
      fs.writeFileSync(projectLogPath, '');
      this.projectLogs.set(projectId, []);
      await this.addLog('info', `Logs del proyecto ${projectId} limpiados`);
    } else {
      fs.writeFileSync(this.logFile, '');
      await this.addLog('info', 'Logs principales limpiados');
    }
  }
}

module.exports = LogManager;