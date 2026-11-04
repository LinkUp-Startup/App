---
name: Nocturne Kinetic
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#cac3d6'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#948e9f'
  outline-variant: '#494553'
  surface-tint: '#cdbdff'
  primary: '#cdbdff'
  on-primary: '#370095'
  primary-container: '#9b7bff'
  on-primary-container: '#300085'
  inverse-primary: '#6745c7'
  secondary: '#d3fbff'
  on-secondary: '#00363a'
  secondary-container: '#00eefc'
  on-secondary-container: '#00686f'
  tertiary: '#ffba38'
  on-tertiary: '#432c00'
  tertiary-container: '#c08600'
  on-tertiary-container: '#3a2600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e8ddff'
  primary-fixed-dim: '#cdbdff'
  on-primary-fixed: '#20005e'
  on-primary-fixed-variant: '#4f28ae'
  secondary-fixed: '#7df4ff'
  secondary-fixed-dim: '#00dbe9'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#ffdeac'
  tertiary-fixed-dim: '#ffba38'
  on-tertiary-fixed: '#281900'
  on-tertiary-fixed-variant: '#604100'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '800'
    lineHeight: 52px
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '800'
    lineHeight: 42px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system targets university students and young adults navigating after-dark social life, bar-hopping, and street-level exploration in Lleida. The atmosphere reflects late-night energy: magnetic, electric, nocturnal, and social. Rather than appearing purely utility-driven or strictly gaming-oriented, the interface merges high-utility nightlife coordination with an immersive, gamified augmented-reality HUD.

The visual direction merges **Translucent Glassmorphism** with **Vibrant Cyber-Atmospherics**. Deep nocturnal backdrops anchor high-contrast luminous accents, translucent frost-tinted overlays, and subtle energy gradients. The system balances high legibility under varying ambient outdoor night light with playful, tactile feedback—inviting spontaneous group decision-making, rapid itinerary updates, and playful micro-achievements without visual fatigue.

## Colors
The color hierarchy is engineered with a dark-first foundation, honoring spontaneous night mobility and power-conscious mobile usage while delivering an energetic daytime mode.

### Primary Spectrum
- **Primary Vivid Purple**: `#9B7BFF` (Dark mode hero) / `#6C3CE1` (Light mode anchor). Represents the social thread, party routes, primary action triggers, and active itinerary branches.
- **On-Primary**: `#FFFFFF` on `#6C3CE1`; `#0B061A` on `#9B7BFF`.

### Gamified & Accent Spectrum
- **Electric Cyan (`#00F0FF`)**: AR Waypoints, live navigation beacons, active radar rings, and peer proximity pings.
- **Electric Amber (`#FFB300`)**: 'Night Quest' progression, XP streaks, limited-time venue perks, and reward badges.
- **Emerald Green (`#2B9A66`)**: Venue capacity clearance, completed itinerary stops, and confirmed guest attendance.
- **Coral Red (`#D93036`)**: Venue closing alerts, missed check-ins, system warnings, and cancellation triggers.

### Surface Architecture & Neutrals
- **Dark Mode (Default)**:
  - Base canvas: `#0F0F12` (deep obsidian).
  - Raised card & surface: `#212225` with 80% to 90% opacity over ambient map canvas.
  - Floating overlays / HUD pods: `rgba(33, 34, 37, 0.72)` paired with `backdrop-filter: blur(16px)`.
  - Secondary typography & icons: `#B0B4BA`.
  - High-emphasis typography: `#FFFFFF`.
- **Light Mode**:
  - Base canvas: `#FFFFFF`.
  - Card & surface: `#F0F0F3`.
  - Secondary typography & icons: `#60646C`.
  - High-emphasis typography: `#121316`.

## Typography
Typographic pairings rely on **Plus Jakarta Sans** for expressive, friendly geometry in headers, display counters, and HUD metrics, paired with **Inter** for high-clarity legibility across map annotations, itinerary timelines, and dense chat surfaces.

- **Display & Headlines**: Bold, rhythmic geometric structures provide immediate punch on mobile displays during movement.
- **Body**: Neutral grotesque proportions with open counters ensure rapid reading at arms-length in dark outdoor surroundings.
- **Labels & Micro-HUD**: Capitalized, tight-tracking tokens for quest waypoints, ETA tags, and live venue statuses.

## Layout & Spacing
The layout follows a responsive 8px baseline grid designed primarily around hand-held, one-thumb usability.

### Layout Mechanics
- **Mobile (Base, 360px - 599px)**: 4-column fluid layout with `margin: 1rem` (16px) and `gutter: 1rem` (16px). All core interactions (joining quests, rerouting stops, confirming stops) live within bottom-anchored floating sheets to ensure single-hand reachability.
- **Tablet (600px - 1023px)**: 8-column layout with `margin-tablet: 2rem` (32px). The viewport switches into split-screen mode: live AR/spatial map pinned on one half, timeline itinerary planner occupying the other.
- **Desktop (1024px+)**: 12-column layout with `margin-desktop: 3rem` (48px) centered to a max container width of 1280px. Used primarily for comprehensive pre-night itinerary planning and community admin hubs.

### Tap Targets
Every interactive control (chips, steppers, navigation icons, waypoints) adheres to a strict minimum hit area of 48×48px, preventing mis-taps during nocturnal transit or dynamic outdoor conditions.

## Elevation & Depth
Elevation is achieved using translucent tonal layering, frosted surface treatments, and luminous perimeter glows rather than standard opaque dropshadows.

### Depth Hierarchy
1. **Level 0 (Canvas Base)**: Pure background (`#0F0F12` in dark, `#FFFFFF` in light) holding the basemap or native camera feed.
2. **Level 1 (Structural Cards)**: Surface base (`#212225` in dark, `#F0F0F3` in light) with a crisp 1px perimeter stroke (`rgba(255, 255, 255, 0.08)` in dark; `rgba(0, 0, 0, 0.06)` in light).
3. **Level 2 (Floating Action Panels & Sheets)**: Translucent surface (`rgba(33, 34, 37, 0.85)` in dark) layered with `backdrop-filter: blur(20px)` and an ambient elevation shadow: `0 8px 32px rgba(0, 0, 0, 0.45)`.
4. **Level 3 (Interactive HUD & Modal Overlays)**: Glass surface (`rgba(20, 20, 24, 0.90)`), 1px border stroke illuminated via primary or cyan tints: `box-shadow: 0 0 24px rgba(155, 123, 255, 0.25)`.

### Waypoint & Quest Glows
Gamified elements feature neon bloom treatments:
- **Active Navigation Waypoints**: Radial luminescence with `box-shadow: 0 0 16px rgba(0, 240, 255, 0.50)`.
- **Completed Quest Triggers / Perks**: `box-shadow: 0 0 16px rgba(255, 179, 0, 0.45)`.

## Shapes
The visual character uses a friendly yet disciplined geometry that bridges physical social invitations and contemporary gaming interfaces.

- **Cards, Buttons & Sheets**: Configured with a default curvature of 12px (`rounded-md` to `rounded-lg`), delivering soft, comfortable visual borders that frame night images and venue banners neatly.
- **Pill Elements**: Chips, tags, navigation state bubbles, floating counters, and mini HUD readouts use full-radius pill styling (`border-radius: 9999px`).
- **Interactive Touch Targets**: Even when containing compact icons, interactive containers maintain rounded 12px or pill bounds to maintain geometric cohesion.

## Components

### Buttons
- **Primary Action (CTA)**: 12px rounded radius, minimum height of 48px. Built with primary purple gradient (`linear-gradient(135deg, #9B7BFF 0%, #6C3CE1 100%)`), text in bold white, and subtle neon back-glow on hover/press.
- **Secondary / Ghost HUD Action**: Translucent dark surface with 1px border (`rgba(255, 255, 255, 0.15)`), active press feedback changes border to cyan (`#00F0FF`).
- **Floating AR Action**: Circular (56×56px) or pill HUD button, frosted glass surface (`backdrop-filter: blur(16px)`), centered high-contrast glyph.

### Chips & Filters
- **Pill-shaped**: Height 36px (within 48px hit wrapper).
- **Default State**: Surface container with soft outline.
- **Selected State**: High-saturation fill using primary purple or accent amber/cyan with matching high-contrast text. Accompanied by micro-emojis or icon badges for rapid bar/club filtering (e.g., "Tap Beers", "Live DJ", "Free Entry").

### Stop Timeline & Route Stepper
- **Vertical Route Spine**: 2px dynamic path running down the left flank. Inactive segments render in muted grey (`rgba(255, 255, 255, 0.15)`); cleared legs illuminate in emerald green; live in-progress legs display pulsing cyan animated dashes.
- **Timeline Nodes**: 28px circular markers with an internal status dot. Active waypoint expands to 36px with outer glow.
- **Timeline Card Content**: Pinned directly beside each node, showing venue name, group arrival ETA, current vibe meter, and pending quest challenge.

### Plan Cards
- **Itinerary Overview Card**: Surface `#212225` (dark) or `#F0F0F3` (light) with 12px radius. Features stacked member avatars, real-time vote toggles, and expandable stop details.
- **Interactive Sliders / Steppers**: Large, thumb-friendly numeric steppers for group tallying and dynamic ETA adjustments with haptic click cues.

### Checkboxes, Radio Buttons & Toggles
- **Radio / Selection Dots**: 24px circles with a 48px touch zone. Active state triggers cyan or purple fill with inset white dot.
- **Toggle Switches**: Pill shape, 52×32px. Inactive thumb uses muted neutral; active thumb slides across a glowing purple-to-cyan track.

### Input Fields & Search Bars
- **Surface**: Subtle inset fill (`rgba(255, 255, 255, 0.05)` in dark mode) paired with 12px border radius and 48px height.
- **Focus State**: Stroke transitions to vivid purple (`#9B7BFF`) accompanied by a subtle 2px soft bloom. Icon prefix for instant venue or friend search.

### 'Night Quest' HUD Card (Specialty Component)
- Floating bottom-anchored HUD drawer for camera AR overlay.
- Semi-translucent obsidian glass backing (`rgba(15, 15, 18, 0.85)`).
- Progress meter featuring amber-to-cyan segmented bar depicting group distance to next secret venue or drink discount redemption.