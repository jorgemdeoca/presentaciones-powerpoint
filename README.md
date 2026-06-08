# SlideForge

Plataforma de presentaciones premium con IA (TanStack Start + Supabase + Gemini).

## Requisitos

- [Bun](https://bun.sh) o Node 20+
- Proyecto [Supabase](https://supabase.com) con Auth (email + Google OAuth)
- API key de [Google AI Studio](https://aistudio.google.com/)

## Setup

```bash
bun install
cp .env.example .env
# Completa las variables en .env
```

Aplica migraciones en Supabase:

```bash
npx supabase db push
```

## Desarrollo

```bash
bun run dev
```

Abre `http://localhost:3000` — inicia sesión en `/login` antes de crear presentaciones.

## Variables de entorno

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_PUBLISHABLE_KEY` | Anon key (servidor) |
| `VITE_SUPABASE_*` | Cliente browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo si usas operaciones admin en worker |
| `GEMINI_API_KEY` | Generación de texto/JSON e imágenes |
| `GEMINI_MODEL` | Opcional. Por defecto prueba `gemini-2.5-flash`, luego `gemini-2.0-flash` |
| `VITE_POSTHOG_KEY` | Analytics opcional |

## Arquitectura MVP

- **Auth:** Supabase Auth + RLS por `user_id`
- **Generación:** Pipeline 2 fases (Planner+Writer → Art Director) + imágenes async
- **Layouts:** 8 componentes React (`hero_minimal`, `split_left`, `split_right`, `quote`, `metric_blocks`, `bento_grid`, `cinematic`, `title_content`)
- **Progreso:** `/generating/:id` con polling de `generation_step`

## Auth: límite de correos (`email rate limit exceeded`)

Supabase en plan gratuito envía **muy pocos emails** (registro, confirmación). Si pruebas muchas veces «Crear cuenta», verás ese error.

**Solución rápida para desarrollo:**

1. Supabase → **Authentication** → **Providers** → **Email**
2. Desactiva **「Confirm email」** (confirmación por correo)
3. Guarda

Así el registro **no envía correo** y no consume el límite. Luego usa **Iniciar sesión** con la misma contraseña.

**Otras opciones:**

- **Continuar con Google** (no usa el cupo de emails de Supabase)
- **Authentication → Users → Add user** (crear usuario manual en el panel)
- Esperar ~1 hora si el límite horario ya se agotó
- Producción: SMTP propio en Supabase (**Project Settings → Auth → SMTP**)

## Deploy

Recomendado: Vercel + Supabase Cloud. Configura las mismas variables en el dashboard de Vercel.
