# Implementation Plan: TaxFlow Auth & RBAC

## Overview

Implement authentication and role-based access control for TaxFlow Pro Phase 1. The existing codebase has scaffolded components with inline styles and CSS keyframe animations. This plan incrementally refactors to Framer Motion animations, adds form validation, wires AuthContext properly, builds out all four role-specific dashboards, and adds responsive behavior — all using Tailwind CSS utilities and glassmorphism styling.

## Tasks

- [x] 1. Set up testing infrastructure
  - [x] 1.1 Install Vitest, React Testing Library, jsdom, and fast-check as dev dependencies
    - Run `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom fast-check`
    - Add `"test": "vitest --run"` script to package.json
    - Create `vitest.config.js` (or extend `vite.config.js`) with jsdom environment and setup file
    - Create `taxflow-app/src/test/setup.js` importing `@testing-library/jest-dom`
    - _Requirements: Testing Strategy (Design)_

- [x] 2. Implement AuthContext and authentication state management
  - [x] 2.1 Refactor AuthContext in App.jsx
    - Extract AuthContext, AuthProvider, and useAuth hook into `taxflow-app/src/context/AuthContext.jsx`
    - AuthProvider stores `user` state (Role | null) via useState
    - Expose `login(role)` that sets user after a 400ms transition delay
    - Expose `logout()` that clears user to null
    - Wrap App's children with AnimatePresence for login/shell transitions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.2_

  - [ ]* 2.2 Write property test: login sets the authenticated role
    - **Property 2: Login sets the authenticated role**
    - Generate random role from {superadmin, cxo, employee, client}, call login, verify user state equals that role
    - **Validates: Requirements 3.2, 4.2**

  - [ ]* 2.3 Write property test: login then logout returns to unauthenticated state
    - **Property 3: Login then logout returns to unauthenticated state**
    - Generate random role, login then logout, verify user is null
    - **Validates: Requirements 4.3, 6.5**

  - [ ]* 2.4 Write property test: auth state exclusively determines the rendered view
    - **Property 4: Auth state exclusively determines the rendered view**
    - Generate random auth states (null or valid role), render App, verify LoginScreen shows iff user is null and AppShell shows iff user is not null
    - **Validates: Requirements 4.4, 4.5**

- [x] 3. Implement LoginScreen with glassmorphism, floating labels, and validation
  - [x] 3.1 Build AnimatedBackground component
    - Create `taxflow-app/src/components/AnimatedBackground.jsx`
    - Render 3 slow-moving radial gradient orbs using CSS animations or Framer Motion
    - Fixed position behind login card, dark mode color palette
    - _Requirements: 1.1, 1.5_

  - [x] 3.2 Implement FloatingLabel input component
    - Create `taxflow-app/src/components/FloatingLabel.jsx`
    - Animate label from placeholder position to above input on focus or when value is non-empty
    - Add hover micro-interaction (subtle border glow)
    - Support password toggle for password type
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Refactor LoginScreen with glassmorphism card, form validation, and demo buttons
    - Update `taxflow-app/src/components/LoginScreen.jsx`
    - Centered frosted-glass card: `backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl` with min border-radius 16px
    - Inter font family, dark mode palette (deep blacks, slate grays, white text, cyan accent)
    - Email and Password FloatingLabel inputs with state management
    - Submit button disabled when both email AND password are empty (Req 2.6); submission blocked if either is empty (Req 2.4, 2.5)
    - Exactly 4 Demo Role Buttons: "Super Admin", "CXO/Partner", "Employee/Tax Preparer", "Client"
    - Demo buttons call `login(roleId)` on click with hover micro-interactions (scale, glow)
    - Framer Motion spring/ease-out entry animation for the card
    - Generous padding, rounded corners, strict visual alignment
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 12.1_

  - [ ]* 3.4 Write property test: form submission requires non-empty credentials
    - **Property 1: Form submission requires non-empty credentials**
    - Generate arbitrary strings for email/password, verify submit button is disabled iff either field is empty
    - **Validates: Requirements 2.4, 2.5, 2.6**

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement AppShell, Sidebar, and TopNav
  - [x] 5.1 Refactor AppShell with layout and dashboard routing
    - Update `taxflow-app/src/components/AppShell.jsx`
    - Fixed sidebar on left (240px expanded, 72px collapsed), sticky TopNav at top, scrollable main content
    - Dashboard selection via role-to-component map: superadmin→SuperAdminDashboard, cxo→CXODashboard, employee→EmployeeDashboard, client→ClientDashboard
    - Wrap dashboard area with AnimatePresence and motion.main for fade transitions on role change
    - Responsive: auto-collapse sidebar below 1024px viewport
    - Tailwind CSS utility classes for all layout styling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 11.2, 11.3_

  - [x] 5.2 Refactor Sidebar with collapsible navigation and role-specific items
    - Update `taxflow-app/src/components/Sidebar.jsx`
    - Accept `collapsed` and `onToggle` props
    - Render role-specific nav items from NAV_ITEMS[role] with Lucide React icons
    - Collapse toggle button, smooth width transition (0.3s cubic-bezier)
    - User profile section at bottom with role initials, label, and logout button
    - Hover micro-interactions on nav items (background highlight)
    - _Requirements: 6.2, 6.3, 6.6, 6.7, 12.4_

  - [x] 5.3 Refactor TopNav with glassmorphism and role display
    - Update `taxflow-app/src/components/TopNav.jsx`
    - Glassmorphism styling: `backdrop-blur-xl` translucent background, soft shadow
    - Display current role name from ROLE_META, logout action, notification bell, avatar
    - Date string on left, Box AI connection badge center
    - _Requirements: 6.1, 6.4, 6.5_

  - [ ]* 5.4 Write property test: role-to-dashboard mapping is correct
    - **Property 5: Role-to-dashboard mapping is correct**
    - Generate random role, render AppShell, verify the correct dashboard component is rendered
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]* 5.5 Write property test: sidebar collapse toggle is a round trip
    - **Property 6: Sidebar collapse toggle is a round trip**
    - Generate random initial collapsed state, toggle twice, verify return to original state
    - **Validates: Requirements 6.3**

  - [ ]* 5.6 Write property test: TopNav displays the current role name
    - **Property 7: TopNav displays the current role name**
    - Generate random role, render TopNav, verify it contains the role's label from ROLE_META
    - **Validates: Requirements 6.4**

  - [ ]* 5.7 Write property test: sidebar displays role-specific navigation items
    - **Property 8: Sidebar displays role-specific navigation items**
    - Generate random role, render Sidebar, verify nav items match NAV_ITEMS[role] labels
    - **Validates: Requirements 6.6**

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement shared UI components
  - [x] 7.1 Refactor shared UI components in ui.jsx
    - Update `taxflow-app/src/components/ui.jsx`
    - Implement/refactor: StatCard, SectionHeader, GlassPanel, PanelTitle, StatusDot, ProgressBar, Badge
    - All components use Tailwind CSS utility classes and glassmorphism patterns
    - GlassPanel: backdrop-blur, translucent bg, border, rounded corners
    - StatCard: metric card with label, value, change indicator, icon
    - ProgressBar: horizontal bar with glow effect
    - _Requirements: 11.4_

- [x] 8. Implement SuperAdminDashboard
  - [x] 8.1 Build SuperAdminDashboard with mock data and widgets
    - Update `taxflow-app/src/components/dashboards/SuperAdminDashboard.jsx`
    - System health metrics widget (server status, active users, storage usage) with mock data
    - User management section with mock user entries and role labels
    - Box AI Integration Status widget with mock connection status and processing metrics
    - Use StatCard, GlassPanel, ProgressBar, SectionHeader from ui.jsx
    - Staggered fade-in-up Framer Motion animations on load (50-150ms delay per widget)
    - Responsive grid layout adjusting columns by viewport width
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 11.3, 12.3_

  - [ ]* 8.2 Write unit tests for SuperAdminDashboard
    - Verify system health widget, user management section, and Box AI widget render
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Implement CXODashboard
  - [x] 9.1 Build CXODashboard with mock data and widgets
    - Update `taxflow-app/src/components/dashboards/CXODashboard.jsx`
    - Portfolio overview widget with mock chart data (bar/progress indicators)
    - Firm-wide compliance rate as percentage with visual progress indicator
    - Overdue alerts section with mock items (client names, due dates)
    - Staggered fade-in-up Framer Motion animations on load
    - Responsive grid layout
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.3, 12.3_

  - [ ]* 9.2 Write unit tests for CXODashboard
    - Verify portfolio widget, compliance rate, and overdue alerts render
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Implement EmployeeDashboard
  - [x] 10.1 Build EmployeeDashboard with mock data and widgets
    - Update `taxflow-app/src/components/dashboards/EmployeeDashboard.jsx`
    - Assigned clients list with mock entries (names, tax year status)
    - Pending Review queue with mock documents
    - AI Insights panel with mock Box AI extraction summaries (fields, confidence scores)
    - Staggered fade-in-up Framer Motion animations on load
    - Responsive grid layout
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 11.3, 12.3_

  - [ ]* 10.2 Write unit tests for EmployeeDashboard
    - Verify assigned clients, pending review, and AI insights render
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 11. Implement ClientDashboard
  - [x] 11.1 Build ClientDashboard with mock data, widgets, and upload dropzone
    - Update `taxflow-app/src/components/dashboards/ClientDashboard.jsx`
    - Tax year progress widget with mock completion percentage and milestone steps
    - Requests from Preparer list with mock items and status indicators
    - Upload to Box Secure Vault dropzone with dashed border and upload icon
    - Dropzone highlights on drag-over (border color change or glow)
    - Staggered fade-in-up Framer Motion animations on load
    - Responsive grid layout
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.3, 12.3_

  - [ ]* 11.2 Write unit tests for ClientDashboard
    - Verify progress widget, preparer requests, upload dropzone render
    - Test dropzone highlights on drag-over
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 12. Responsive layout and LoginScreen mobile adaptation
  - [x] 12.1 Add responsive breakpoints to LoginScreen and AppShell
    - LoginScreen: stack elements vertically and reduce padding below 768px viewport
    - AppShell: responsive dashboard widget grid adjusting column count by viewport width
    - Use Tailwind CSS responsive utility classes (sm:, md:, lg:)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 13. Animation and micro-interaction polish
  - [x] 13.1 Ensure Framer Motion animations and micro-interactions across all components
    - LoginScreen page entry: spring or ease-out physics via Framer Motion
    - Login-to-AppShell transition: smooth opacity/scale 300-600ms via AnimatePresence
    - All clickable elements respond with micro-interaction within 100ms
    - Dashboard widget staggered entry with 50-150ms delays
    - Verify all hover states on buttons, nav items, and interactive elements
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 14. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific structural checks and edge cases
- The existing scaffolded components will be refactored in-place rather than rewritten from scratch
