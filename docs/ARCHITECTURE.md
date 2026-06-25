# ABONIBAL Platform Architecture

Version: 1.0

---

# Vision

ABONIBAL is not an accounting application.

ABONIBAL is an Enterprise Platform.

Everything inside the platform must be modular, reusable and independent.

---

# Core Principles

## 1. Single Responsibility

Every class has one responsibility.

Examples:

ProductRepository

↓

Stores products only.

ProductService

↓

Business logic only.

ProductDialog

↓

UI only.

---

## 2. Dependency Direction

Always:

Modules

↓

Framework

↓

Core

Never:

Core

↓

Modules

---

## 3. Dependency Injection

Business classes never instantiate dependencies.

Forbidden:

new ProductRepository()

new ProductService()

Allowed:

Container

↓

Repository

↓

Service

---

## 4. Repository Pattern

Modules never access Storage directly.

Allowed:

Module

↓

Repository

↓

Driver

↓

Storage

Forbidden:

localStorage

inside modules.

---

## 5. Event Driven Architecture

Modules communicate through EventBus.

Never:

Module

↓

Module

Always:

Module

↓

EventBus

↓

Module

---

## 6. UI Kit

HTML duplication is forbidden.

Every repeated UI becomes a Component.

Examples:

Button

Dialog

Table

Badge

Card

Input

Toast

Loading

EmptyState

---

## 7. Design System

Colors

Spacing

Radius

Typography

Animations

must come from:

src/ui/styles

Never inside modules.

---

## 8. Controllers

Pages never contain business logic.

Page

↓

Controller

↓

Service

↓

Repository

---

## 9. Build Rule

Every Patch ends with:

pnpm exec tsc --noEmit

No exceptions.

---

## 10. Clean Commits

One Feature

↓

One Commit

Never mix unrelated changes.

---

# Project Layers

src/

core/

framework/

ui/

modules/

docs/

---

# Module Structure

products/

customers/

sales/

purchases/

inventory/

accounting/

Every module follows exactly the same architecture.

---

# Goal

Build an Enterprise Platform capable of growing for many years without architectural degradation.

# Naming Convention

Classes

ProductController

ProductService

ProductRepository

ProductDialog

ProductTable

Files always match class names.

---

# Error Handling

Business errors never use alert().

Controllers return Result objects.

UI decides how to display errors.

---

# Persistence Rule

Repositories never know if data comes from:

- LocalStorage
- IndexedDB
- SQLite
- Firebase
- REST API

Repositories only use Drivers.

---

# Testing Rule

Every Service must be testable without UI.

Business logic must never depend on DOM.

---

# Performance Rule

Never re-render the whole page if only one component changes.

Update only the affected component.

---

# Golden Module Rule

Products is the reference implementation.

Every future module must follow Products architecture.

Never invent a different architecture for Customers or Suppliers.

# ABONIBAL Rule

If a feature cannot be implemented without breaking the architecture,

the architecture wins.

Features may wait.

Architecture never breaks.

