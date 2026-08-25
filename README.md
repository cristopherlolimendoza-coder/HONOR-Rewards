# HONOR Rewards

Marketplace de incentivos FFVV · Entel Empresas.

## Arquitectura

- `/` — Marketplace público para FFVV.
- `/admin/` — Panel privado de validación.
- `/api/catalog` — Stock y cuotas en tiempo real.
- `/api/redeem` — Registro de canjes.
- `/api/admin/*` — Operaciones protegidas del administrador.
- `/api/health` — Diagnóstico de configuración.
- Cloudflare Pages Functions — Backend.
- Cloudflare D1, binding `DB` — Base de datos centralizada.

## Flujo de stock

1. FFVV registra un canje válido.
2. El premio pasa de **Disponible** a **Reservado**.
3. El administrador puede **Aprobar** o **Rechazar**.
4. Si se rechaza, vuelve automáticamente a **Disponible**.
5. Si se entrega, pasa de **Reservado** a **Entregado**.

## Configuración requerida en Cloudflare Pages

- D1 binding: `DB`
- Secret: `ADMIN_PASSWORD`
- Secret recomendado: `SESSION_SECRET`

No guardar contraseñas dentro del repositorio.

## Stock inicial

- Stanley Café-To-Go: cuota 10, stock 8.
- Stanley Aerolight: cuota 15, stock 8.
- Stanley Vitalize Shaker: cuota 20, stock 5.
- HONOR Choice Auriculares: cuota 10, stock 10.
- HONOR Choice Air Fryer: cuota 40, stock 5.
- Aspiradora Robot HONOR Choice R3: cuota 50, stock 3.

Capacidad mínima total de la dinámica con todo el stock canjeado: **750 unidades vendidas**.
