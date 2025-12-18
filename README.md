# Signal - Agencia Kairos

Plataforma de monitoreo de señales y tendencias en tiempo real con diseño inspirado en High-Frequency Trading.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Language:** TypeScript
- **Locale:** Spanish (es-AR)

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
Signal/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx          # Sidebar layout
│   │   └── page.tsx            # Main feed page
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Redirects to /dashboard
├── components/
│   ├── SignalCard.tsx          # Signal card component
│   └── SignalDetailModal.tsx   # Detail view modal
├── public/
│   ├── Signal.jpg              # Product logo
│   └── Logo Final.png          # Agency logo
└── ...config files
```

## Features Implemented

### Epic 5: User Interface

#### ✅ Story 5.1 & 1.3 - Dashboard Layout
- Persistent sidebar with navigation
- Product logo (Signal.jpg) in header
- Agency logo (Logo Final.png) in footer (20% larger)
- Project context dropdown
- Navigation links: Tablero, Fuentes, Proyectos, Configuración

#### ✅ Story 5.2 - Live Signal Feed
- **Seguimiento Prioritario:** Cards for "Accelerating" signals
  - Teal left border (`border-l-4 border-sky-500`)
  - Subtle glow effect
  - "ACELERANDO" badge with up arrow
- **Monitoreo General:** Cards for "Stabilizing" and "New" signals
  - Gray borders
  - "ESTABILIZADO" and "NUEVO" badges
- Mock data for development

#### ✅ Story 5.3 - Drill-Down Analysis
- SignalDetailModal component
- Full orientation summary (What/Where/Why)
- Source URLs display
- Opens on card click

#### ✅ Story 5.4 - Signal Actions
- "Archivar" (Archive) button
- Visual removal from feed
- Console logging for actions

## Design System

### Theme: High-Frequency Trading Dark Mode
- **Background:** Deep Black (`bg-black`)
- **Cards:** `bg-black` or `bg-gray-950` with `border-gray-800`
- **Accents:** Teal/Sky (`text-sky-500`, `border-sky-500`) for high-priority items
- **Typography:** Inter font family

### Status Colors
- **Accelerating:** Sky/Teal (`sky-500`) with glow effects
- **Stabilizing:** Gray (`gray-400`)
- **New:** Emerald (`emerald-500`)

## Next Steps

### Story 5.5 - Configuration Page
Create `/app/dashboard/settings/page.tsx` with:
- Source URL management UI
- Add new source input form
- Project rename/delete options

### Additional Features
- Connect to real API endpoints
- Implement actual project switching
- Add source management functionality
- Implement filtering system
