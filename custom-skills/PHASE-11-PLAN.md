# PHASE 11 — Browser Navigation (Read-Only Context)

## Filosofía

```
"Ojos, no manos ni boca"
OpenClaw puede VER, no puede ACTUAR ni HABLAR en el browser.
Phase 11 NO aprende, solo observa.
```

## Estado

| Task | Descripción | Estado |
|------|-------------|--------|
| T11.1 | Extension manifest + estructura | 🔄 En progreso |
| T11.2 | Allowlist + validación | ⏳ Pendiente |
| T11.3 | Content extraction + sanitización | ⏳ Pendiente |
| T11.4 | WebSocket bridge | ⛔ No autorizado aún |
| T11.5 | `browser-context` skill | ⛔ No autorizado aún |
| T11.6 | Integración con senior-dev | ⛔ No autorizado aún |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (Chrome Extension)                                         │
│                                                                     │
│  ┌─────────────────┐     ┌─────────────────┐                       │
│  │ Content Script  │     │ Background      │                       │
│  │ (injected)      │     │ Service Worker  │                       │
│  │                 │     │                 │                       │
│  │ • Read DOM      │────▶│ • Allowlist     │                       │
│  │ • Extract text  │     │ • Validate      │                       │
│  │ • Screenshot*   │     │ • Sanitize      │                       │
│  └─────────────────┘     └────────┬────────┘                       │
│                                   │                                 │
│  * Solo si dominio lo permite     │                                 │
│    y se invoca explícitamente     │                                 │
│                                   │                                 │
│  ❌ NO clicks                     │                                 │
│  ❌ NO form fills                 │                                 │
│  ❌ NO navigation                 │                                 │
│  ❌ NO floating UI                │                                 │
│  ❌ NO learning                   │                                 │
└───────────────────────────────────┼─────────────────────────────────┘
                                    │
                          HTTP POST (localhost only)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OPENCLAW SERVER (localhost)                                        │
│                                                                     │
│  ┌─────────────────┐                                               │
│  │ browser-context │     PageContext vive en memoria               │
│  │ skill           │     TTL: 30-60 min máximo                     │
│  │                 │     ❌ NO persistencia largo plazo            │
│  │ • get-page      │     ❌ NO learning                            │
│  │ • get-tables    │     ❌ NO training data                       │
│  │ • screenshot*   │                                               │
│  └─────────────────┘                                               │
│                                                                     │
│  Audit log de todo acceso                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Allowlist de Dominios (DEFINITIVO)

```yaml
# config/browser-allowlist.yaml
version: "1.0"

domains:
  # === Productos propios ===
  - pattern: "carlitos-bot.com"
    access: ["dom", "tables", "screenshot"]

  - pattern: "avocode-bo.online"
    access: ["dom", "tables", "screenshot"]

  - pattern: "conversie-pdf.com"
    access: ["dom", "tables"]

  - pattern: "convierte-pdf.com"
    access: ["dom", "tables"]

  - pattern: "device-finder.com"
    access: ["dom", "tables"]

  - pattern: "noxtools.com"
    access: ["dom", "tables"]

  # === GitHub (SOLO mis repos) ===
  - pattern: "github.com/crissavino/*"
    access: ["dom", "tables"]
    # Solo: repos, PRs, issues bajo crissavino/
    # ❌ NO acceso a GitHub público general

  # === Desarrollo local ===
  - pattern: "localhost:*"
    access: ["dom", "tables", "screenshot"]

  - pattern: "127.0.0.1:*"
    access: ["dom", "tables", "screenshot"]

# === BLOQUEADOS (nunca, aunque el usuario pida) ===
blocked:
  - "ads.google.com"
  - "*.google.com/ads/*"
  - "adwords.google.com"
  - "mail.google.com"
  - "*.banking.*"
  - "*.bank.*"
  - "paypal.com"
  - "stripe.com/dashboard"
```

---

## Reglas de Screenshots

```
REGLA: Screenshots son OPT-IN explícito

1. Solo si el dominio tiene access: ["screenshot"]
2. Nunca automáticos
3. Solo cuando se invoca explícitamente: `browser screenshot`
4. Nada de screenshots implícitos ni por defecto
5. Se guardan temporalmente (TTL igual que PageContext)
```

---

## Persistencia del Contexto

```
REGLA: PageContext NO se persiste a largo plazo

1. Vive en memoria o storage temporal
2. TTL: 30-60 minutos máximo
3. ❌ NO entra en ningún sistema de learning
4. ❌ NO se usa para entrenamiento futuro
5. ❌ NO se guarda en base de datos permanente
6. Al expirar TTL → se borra completamente
```

---

## Restricciones NO NEGOCIABLES

Phase 11 **NO PUEDE Y NO DEBE**:

| Restricción | Razón |
|-------------|-------|
| ❌ Acceder a Google Ads UI | Riesgo de acciones no autorizadas |
| ❌ Hacer clicks | Solo lectura |
| ❌ Completar formularios | Solo lectura |
| ❌ Navegar autónomamente | Usuario controla navegación |
| ❌ Modificar el DOM | Solo lectura |
| ❌ Ejecutar JS arbitrario | Seguridad |
| ❌ Mostrar UI flotante / chatbot | Fuera de scope |
| ❌ Guardar credenciales | Seguridad |
| ❌ Aprender patrones | No es fase de learning |
| ❌ Persistir contexto largo plazo | Privacidad |

Phase 11 **SOLO PUEDE**:

| Capacidad | Condición |
|-----------|-----------|
| ✅ Leer texto visible | Dominios en allowlist |
| ✅ Extraer tablas | Dominios en allowlist |
| ✅ Reportar URL y título | Dominios en allowlist |
| ✅ Tomar screenshots | Dominio + invocación explícita |

---

## Estructura de Archivos

```
extension/
├── manifest.json           # Chrome extension manifest v3
├── background/
│   └── service-worker.js   # Allowlist validation, message handling
├── content/
│   ├── extractor.js        # DOM reader, table parser
│   └── sanitizer.js        # Strip sensitive data
├── config/
│   └── allowlist.json      # Compiled allowlist
└── icons/
    └── ...

skills/browser-context/
├── index.ts                # Main exports
├── cli.ts                  # CLI commands
├── types.ts                # PageContext, etc.
├── context-store.ts        # In-memory storage with TTL
└── allowlist-checker.ts    # Domain validation
```

---

## API del PageContext

```typescript
interface PageContext {
  // Identificación
  url: string;
  domain: string;
  title: string;
  extractedAt: string;
  expiresAt: string;        // TTL enforcement

  // Contenido (sanitizado)
  textContent: string;
  tables: ExtractedTable[];
  headings: string[];
  links: ExtractedLink[];

  // Screenshot (opcional, explícito)
  screenshot?: {
    data: string;           // Base64
    takenAt: string;
    expiresAt: string;
  };
}

interface ExtractedTable {
  headers: string[];
  rows: string[][];
}

interface ExtractedLink {
  text: string;
  href: string;
}
```

---

## CLI Commands (Futuro - T11.5)

```bash
# Ver estado de conexión
browser status

# Obtener contexto de página actual (si en allowlist)
browser get-page

# Extraer tablas
browser get-tables

# Screenshot (solo si dominio lo permite + invocación explícita)
browser screenshot
```

---

## Validación de Fase

Antes de considerar Phase 11 completa, verificar:

- [ ] Extension funciona solo en dominios allowlist
- [ ] Dominios bloqueados son rechazados correctamente
- [ ] Screenshots solo con invocación explícita
- [ ] PageContext expira después de TTL
- [ ] No hay persistencia a largo plazo
- [ ] No hay capacidad de click/form/navigate
- [ ] Audit log registra todos los accesos
- [ ] No hay UI flotante en el browser

---

## Relación con Otras Fases

```
PHASE 10 (Senior Dev Skill)
├── T10.3 en uso real (1-2 semanas)
├── Congelada hasta evaluación
└── ❌ T10.4 no autorizado aún

PHASE 11 (Browser Navigation)
├── T11.1-T11.3 autorizados
├── T11.4-T11.6 no autorizados aún
└── Independiente de Phase 10
```

---

*Documento creado: 2026-02-02*
*Última actualización: 2026-02-02*
