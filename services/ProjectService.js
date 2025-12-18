const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const portscanner = require('portscanner');

// Función para obtener procesos
async function getProcesses() {
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

class ProjectService {
  constructor() {
    this.projectsConfig = this.loadProjectsConfig();
    this.projectStatuses = new Map();
    this.initializeStatuses();
  }

  loadProjectsConfig() {
    try {
      const configPath = path.join(__dirname, '../config/projects.json');
      return fs.readJsonSync(configPath);
    } catch (error) {
      console.error('Error cargando configuración de proyectos:', error);
      return {};
    }
  }

  async initializeStatuses() {
    for (const [projectId, config] of Object.entries(this.projectsConfig)) {
      try {
        const status = await this.getProjectStatus(projectId);
        this.projectStatuses.set(projectId, status);
      } catch (error) {
        console.error(`Error inicializando ${projectId}:`, error.message);
        this.projectStatuses.set(projectId, { 
          running: false, 
          error: error.message,
          lastCheck: new Date()
        });
      }
    }
  }

  getAllProjects() {
    return Object.entries(this.projectsConfig).map(([id, config]) => ({
      id,
      ...config,
      status: this.projectStatuses.get(id) || { running: false, pid: null }
    }));
  }

  getProjectsCount() {
    return Object.keys(this.projectsConfig).length;
  }

  async getProjectStatus(projectId) {
    const config = this.projectsConfig[projectId];
    if (!config) {
      throw new Error(`Proyecto ${projectId} no encontrado`);
    }

    try {
      // Verificar si el puerto está en uso
      const port = config.defaultPort;
      const portStatus = await portscanner.checkPortStatus(port, 'localhost');
      
      // Buscar procesos relacionados
      const processes = await getProcesses();
      const projectProcesses = processes.filter(proc => 
        proc.cmd && (
          proc.cmd.includes(projectId) ||
          proc.cmd.includes(config.name.toLowerCase().replace(/\s+/g, '-')) ||
          (config.serviceScript && proc.cmd.includes(config.serviceScript)) ||
          (portStatus === 'open' && this.isProcessOnPort(proc, port))
        )
      );

      const isRunning = projectProcesses.length > 0 && portStatus === 'open';
      const mainProcess = projectProcesses[0];

      return {
        running: isRunning,
        pid: mainProcess ? mainProcess.pid : null,
        processes: projectProcesses.map(p => ({
          pid: p.pid,
          name: p.name,
          cmd: p.cmd,
          cpu: p.cpu,
          memory: p.memory
        })),
        port: {
          number: port,
          status: portStatus,
          url: this.getServiceUrl(config, portStatus === 'open')
        },
        lastCheck: new Date()
      };
    } catch (error) {
      console.error(`Error verificando estado de ${projectId}:`, error);
      return {
        running: false,
        pid: null,
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  async getAllProjectsStatus() {
    const statuses = {};
    for (const projectId of Object.keys(this.projectsConfig)) {
      try {
        const status = await this.getProjectStatus(projectId);
        this.projectStatuses.set(projectId, status);
        statuses[projectId] = status;
      } catch (error) {
        console.error(`Error en ${projectId}:`, error.message);
        statuses[projectId] = {
          running: false,
          error: error.message,
          lastCheck: new Date()
        };
      }
    }
    return statuses;
  }

  async startProject(projectId) {
    const config = this.projectsConfig[projectId];
    if (!config) {
      throw new Error(`Proyecto ${projectId} no encontrado`);
    }

    try {
      const currentStatus = await this.getProjectStatus(projectId);
      if (currentStatus.running) {
        return { success: false, message: 'El proyecto ya está en ejecución' };
      }

      let result;

      if (config.dockerCompose) {
        result = await this.startDockerProject(config);
      } else if (config.serviceScript) {
        result = await this.startScriptProject(config);
      } else {
        result = await this.startManualProject(config);
      }

      // Esperar y verificar estado
      await this.sleep(3000);
      const newStatus = await this.getProjectStatus(projectId);
      this.projectStatuses.set(projectId, newStatus);

      return { 
        success: newStatus.running, 
        message: result.message,
        url: newStatus.port.url 
      };
    } catch (error) {
      throw new Error(`Error iniciando ${config.name}: ${error.message}`);
    }
  }

  async startDockerProject(config) {
    const { path, dockerPath } = config;
    const workingDir = dockerPath || path;

    if (!fs.existsSync(workingDir)) {
      throw new Error(`Directorio no encontrado: ${workingDir}`);
    }

    return new Promise((resolve, reject) => {
      exec(`cd "${workingDir}" && docker-compose up -d`, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Docker Compose error: ${stderr}`));
        } else {
          resolve({ message: 'Proyecto Docker iniciado correctamente' });
        }
      });
    });
  }

  async startScriptProject(config) {
    const { path, serviceScript } = config;
    const scriptPath = path.join(path, serviceScript);

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script no encontrado: ${scriptPath}`);
    }

    return new Promise((resolve, reject) => {
      exec(`cd "${path}" && chmod +x "${serviceScript}" && ./"${serviceScript}" start`, 
        { timeout: 30000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Script error: ${stderr}`));
          } else {
            resolve({ message: 'Servicio iniciado correctamente' });
          }
        }
      );
    });
  }

  async startManualProject(config) {
    // Para proyectos sin script automatizado
    return { message: 'Proyecto requiere inicio manual - revisa la documentación' };
  }

  async stopProject(projectId) {
    const config = this.projectsConfig[projectId];
    if (!config) {
      throw new Error(`Proyecto ${projectId} no encontrado`);
    }

    try {
      const currentStatus = await this.getProjectStatus(projectId);
      if (!currentStatus.running) {
        return { success: false, message: 'El proyecto no está en ejecución' };
      }

      let result;

      if (config.dockerCompose) {
        result = await this.stopDockerProject(config);
      } else if (config.serviceScript) {
        result = await this.stopScriptProject(config);
      } else {
        result = await this.stopManualProject(currentStatus);
      }

      // Esperar y verificar estado
      await this.sleep(3000);
      const newStatus = await this.getProjectStatus(projectId);
      this.projectStatuses.set(projectId, newStatus);

      return { 
        success: !newStatus.running, 
        message: result.message 
      };
    } catch (error) {
      throw new Error(`Error deteniendo ${config.name}: ${error.message}`);
    }
  }

  async stopDockerProject(config) {
    const { path, dockerPath } = config;
    const workingDir = dockerPath || path;

    return new Promise((resolve, reject) => {
      exec(`cd "${workingDir}" && docker-compose down`, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Docker Compose error: ${stderr}`));
        } else {
          resolve({ message: 'Proyecto Docker detenido correctamente' });
        }
      });
    });
  }

  async stopScriptProject(config) {
    const { path, serviceScript } = config;
    const scriptPath = path.join(path, serviceScript);

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script no encontrado: ${scriptPath}`);
    }

    return new Promise((resolve, reject) => {
      exec(`cd "${path}" && ./"${serviceScript}" stop`, 
        { timeout: 30000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Script error: ${stderr}`));
          } else {
            resolve({ message: 'Servicio detenido correctamente' });
          }
        }
      );
    });
  }

  async stopManualProject(currentStatus) {
    // Matar procesos manualmente
    const processes = currentStatus.processes || [];
    
    for (const process of processes) {
      try {
        process.kill(process.pid);
      } catch (error) {
        console.error(`Error matando proceso ${process.pid}:`, error);
      }
    }

    return { message: 'Procesos detenidos manualmente' };
  }

  async restartProject(projectId) {
    await this.stopProject(projectId);
    await this.sleep(2000);
    return await this.startProject(projectId);
  }

  isProcessOnPort(process, port) {
    // Lógica simplificada - en producción se podría usar netstat o lsof
    return process.cmd && (
      process.cmd.includes(`:${port}`) ||
      process.cmd.includes('node') ||
      process.cmd.includes('python') ||
      process.cmd.includes('docker')
    );
  }

  getServiceUrl(config, isRunning) {
    if (!isRunning) return null;
    
    const port = config.defaultPort;
    const protocol = config.healthCheck?.type === 'https' ? 'https' : 'http';
    return `${protocol}://localhost:${port}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ProjectService;