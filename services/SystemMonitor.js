const si = require('systeminformation');

class SystemMonitor {
  constructor() {
    this.currentInfo = {};
    this.initializeMonitoring();
  }

  async initializeMonitoring() {
    this.currentInfo = await this.getCurrentInfo();
  }

  async getCurrentInfo() {
    try {
      const cpu = await si.currentLoad();
      const mem = await si.mem();
      const osInfo = await si.osInfo();
      const graphics = await si.graphics();
      const diskLayout = await si.diskLayout();

      return {
        cpu: {
          usage: Math.round(cpu.currentLoad || 0),
          cores: cpu.cpus?.length || 1,
          temp: cpu.temperature || null
        },
        memory: {
          total: Math.round(mem.total / 1024 / 1024 / 1024), // GB
          used: Math.round(mem.used / 1024 / 1024 / 1024), // GB
          free: Math.round(mem.free / 1024 / 1024 / 1024), // GB
          percentage: Math.round((mem.used / mem.total) * 100)
        },
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch
        },
        gpu: {
          available: graphics.controllers && graphics.controllers.length > 0,
          controllers: graphics.controllers?.map(gpu => ({
            vendor: gpu.vendor,
            model: gpu.model,
            vram: gpu.vram ? Math.round(gpu.vram / 1024) : null,
            temperature: gpu.temperatureGpu || null
          })) || []
        },
        disk: {
          total: Math.round(diskLayout[0]?.size / 1024 / 1024 / 1024 || 0), // GB
          available: Math.round(diskLayout[0]?.availableSize / 1024 / 1024 / 1024 || 0) // GB
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error obteniendo información del sistema:', error);
      return this.currentInfo || {};
    }
  }

  async getDetailedInfo() {
    try {
      const cpuFull = await si.cpu();
      const memFull = await si.mem();
      const osInfo = await si.osInfo();
      const graphics = await si.graphics();
      const diskFull = await si.fsSize();
      const network = await si.networkInterfaces();
      const processes = await si.processes();

      return {
        cpu: {
          manufacturer: cpuFull.manufacturer,
          brand: cpuFull.brand,
          speed: cpuFull.speed,
          cores: cpuFull.cores,
          physicalCores: cpuFull.physicalCores,
          processors: cpuFull.processors
        },
        memory: {
          total: Math.round(memFull.total / 1024 / 1024 / 1024),
          available: Math.round(memFull.available / 1024 / 1024 / 1024),
          used: Math.round(memFull.used / 1024 / 1024 / 1024),
          swaptotal: Math.round(memFull.swaptotal / 1024 / 1024 / 1024),
          swapused: Math.round(memFull.swapused / 1024 / 1024 / 1024)
        },
        os: osInfo,
        gpu: graphics.controllers || [],
        disk: diskFull,
        network: network.filter(iface => iface.operstate === 'up'),
        processes: (processes.list || [])
          .sort((a, b) => (b.pcpu || 0) - (a.pcpu || 0))
          .slice(0, 10)
          .map(proc => ({
            pid: proc.pid,
            name: proc.name,
            cpu: Math.round(proc.pcpu || 0),
            memory: Math.round(proc.pmem || 0),
            memoryRss: Math.round((proc.memRss || 0) / 1024 / 1024), // MB
            command: proc.command
          })),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error obteniendo información detallada:', error);
      return {};
    }
  }

  // Método para verificar requisitos específicos para proyectos AI
  checkGPURequirements() {
    const gpu = this.currentInfo.gpu;
    
    return {
      hasGPU: gpu.available,
      hasNVIDIA: gpu.controllers.some(g => g.vendor?.toLowerCase().includes('nvidia')),
      hasAMD: gpu.controllers.some(g => g.vendor?.toLowerCase().includes('amd')),
      hasVRAM: gpu.controllers.some(g => g.vram && g.vram >= 6000), // 6GB+
      totalVRAM: Math.max(...gpu.controllers.map(g => g.vram || 0)),
      suitableForAI: gpu.controllers.some(g => 
        g.vram && g.vram >= 6000 && g.vendor?.toLowerCase().includes('nvidia')
      )
    };
  }

  // Método para recomendar proyectos según hardware
  getRecommendedProjects() {
    const gpuInfo = this.checkGPURequirements();
    const memGB = this.currentInfo.memory?.total || 0;
    const cpuCores = this.currentInfo.cpu?.cores || 1;

    const recommendations = {
      lowGPU: [], // Projects that work without GPU
      configurableGPU: [], // Projects that can work with/without GPU
      highGPU: [], // Projects requiring good GPU
      notSuitable: [] // Projects that won't work well
    };

    // Lógica de recomendación basada en hardware
    if (memGB >= 8 && cpuCores >= 4) {
      recommendations.lowGPU.push('video-text-editor', 'penpot', 'open-cut', 'sisgec');
      recommendations.configurableGPU.push('biniou');
    }

    if (gpuInfo.hasNVIDIA && gpuInfo.totalVRAM >= 6000) {
      recommendations.highGPU.push('fauxpilot');
    }

    if (gpuInfo.totalVRAM >= 12000 && memGB >= 32) {
      recommendations.highGPU.push('vace', 'profitpilot');
    }

    if (memGB < 8 || cpuCores < 2) {
      recommendations.notSuitable.push('vace', 'fauxpilot');
    }

    return recommendations;
  }
}

module.exports = SystemMonitor;