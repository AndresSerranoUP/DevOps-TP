import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { HtmlContent } from './common/http/plain-text.decorator';

export function getLandingPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Trabajo Práctico de Andrés Serrano para la materia DevOps - Universidad de Palermo, Facultad de Ingenieria" />
  <title>Trabajo Práctico de Andrés Serrano para la materia DevOps | Universidad de Palermo</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(17, 24, 39, 0.82);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-sub: #64748b;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #06b6d4;
      --success: #10b981;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 2.5rem 1.25rem;
      position: relative;
      overflow-x: hidden;
      line-height: 1.5;
    }
    .background-glow {
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 18% 18%, rgba(99, 102, 241, 0.18) 0%, transparent 45%),
        radial-gradient(circle at 82% 82%, rgba(6, 182, 212, 0.14) 0%, transparent 45%);
      pointer-events: none;
      z-index: 0;
    }
    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 860px;
      margin: 0 auto;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 3rem 2.5rem;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.28);
      color: #a5b4fc;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.825rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
      letter-spacing: 0.02em;
    }
    .badge-icon {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    .title {
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.25;
      margin-bottom: 1.25rem;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .academic-info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.75rem;
      font-size: 0.95rem;
    }
    .academic-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      padding: 0.3rem 0.75rem;
      border-radius: 8px;
    }
    .academic-pill strong {
      color: #f8fafc;
    }
    .description {
      color: var(--text-muted);
      font-size: 1.05rem;
      margin-bottom: 2.25rem;
      line-height: 1.6;
    }
    .actions-group {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 2.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      padding: 0.85rem 1.65rem;
      border-radius: 12px;
      font-size: 0.975rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
    }
    .btn-primary:hover {
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.55);
      transform: translateY(-2px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      color: #ffffff;
    }
    .btn-github {
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.16);
    }
    .btn-github:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.28);
      transform: translateY(-2px);
      color: #ffffff;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 12px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #34d399;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .status-badge:hover {
      background: rgba(16, 185, 129, 0.18);
      transform: translateY(-2px);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
    }
    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
      }
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.25rem;
    }
    .feature-card {
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 1.25rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .feature-card:hover {
      background: rgba(30, 41, 59, 0.55);
      border-color: rgba(99, 102, 241, 0.35);
      transform: translateY(-3px);
    }
    .feature-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .feature-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .feature-tag {
      font-size: 0.75rem;
      font-family: monospace;
      color: #a5b4fc;
      background: rgba(99, 102, 241, 0.12);
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
    }
    .feature-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 1.5rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--text-sub);
    }
    .footer a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }
    .footer a:hover {
      color: #f8fafc;
    }
    @media (max-width: 640px) {
      .card {
        padding: 2rem 1.25rem;
        border-radius: 20px;
      }
      .title {
        font-size: 1.65rem;
      }
      .actions-group {
        flex-direction: column;
        align-items: stretch;
      }
      .btn {
        width: 100%;
      }
      .features-grid {
        grid-template-columns: 1fr;
      }
      .footer {
        flex-direction: column;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="background-glow" aria-hidden="true"></div>
  <main class="container">
    <div class="card">
      <div class="header-badge">
        <svg class="badge-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" />
        </svg>
        <span>Universidad de Palermo &bull; Facultad de Ingeniería (Licenciatura en TI)</span>
      </div>

      <h1 class="title">Trabajo Práctico de Andrés Serrano para la materia DevOps</h1>

      <p class="description">
        API RESTful moderna migrada de C#, desarrollada con arquitectura modular en NestJS, TypeScript y base de datos Azure SQL / MSSQL. Implementa integración y despliegue continuo (CI/CD) mediante GitHub Actions y contenedorización Docker.
      </p>

      <div class="actions-group">
        <a href="/health" class="status-badge" id="badge-health" title="Verificar estado de salud">
          <span class="pulse-dot"></span>
          <span>Health: Activo</span>
        </a>

        <a href="/health/ready" class="btn btn-secondary" id="btn-ready">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>Readiness (/health/ready)</span>
        </a>

        <a href="/docs" class="btn btn-primary" id="btn-swagger">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span>Documentación Swagger (/docs)</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14"/>
            <path d="m12 5 7 7-7 7"/>
          </svg>
        </a>

        <a href="https://github.com/AndresSerranoUP/DevOps-TP" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-github" id="btn-github">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          <span>Repositorio GitHub</span>
        </a>
      </div>

      <footer class="footer">
        <div>&copy; 2026 Andrés Serrano &bull; Universidad de Palermo &bull; Facultad de Ingeniería</div>
        <div>DevOps CI/CD Pipeline &bull; Node.js 24 &bull; NestJS 11</div>
      </footer>
    </div>
  </main>
</body>
</html>`;
}

@Controller()
export class AppController {
  @Get()
  @HtmlContent()
  @ApiExcludeEndpoint()
  getLandingPage(): string {
    return getLandingPageHtml();
  }
}
