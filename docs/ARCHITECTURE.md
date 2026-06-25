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
