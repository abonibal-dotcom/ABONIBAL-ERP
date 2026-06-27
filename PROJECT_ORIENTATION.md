# ABONIBAL ERP Project Orientation

## Purpose

This document orients Codex and human contributors before any Version 1.0 work begins.

## Project Identity

ABONIBAL ERP is not a prototype, sample, demo, or throwaway application. It is an existing ERP project that must be stabilized and completed through disciplined engineering work.

The repository already contains a working foundation, routing shell, persistence layer, Dashboard page, and partial Products module. Most ERP modules required for Version 1.0 are still missing or partial.

## Codex Role

Codex is an engineering executor and investigator.

Codex must not act as product owner or architect of record. Owner decisions and the Engineering Constitution control project direction.

## Operating Rules

- No source code changes before evidence and root cause confirmation.
- No random features.
- No refactor without approved scope.
- No architecture change without approval.
- No product behavior change inside INF, ENV, TOOL, or DOC missions.
- Runtime evidence has priority over terminal output and assumptions.
- Tool failures must not be treated as application failures.
- V1 roadmap order must be followed after governance approval.
- ECS-006 remains blocked until governance baseline is approved.

## Current Project Phase

PATCH-000 stabilization is complete through ECS-005.

The current mission is `V1-INF-001 - Repository Governance & Baseline Lock`.

The next engineering work must be selected only after this governance baseline is reviewed and approved.
