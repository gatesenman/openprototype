# 6.2 Design Rules Engine & Audit

# Design Rules Engine & Audit

<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

- [src/__tests__/core.test.ts](src/__tests__/core.test.ts)
- [src/designsystem/audit.ts](src/designsystem/audit.ts)
- [src/designsystem/rules.ts](src/designsystem/rules.ts)
- [src/interop/importDesign.ts](src/interop/importDesign.ts)
- [src/schema/layout.ts](src/schema/layout.ts)

</details>



The Design Rules Engine and Audit system provides a validation and correction layer for the OpenPrototype design environment. It ensures that generated or manually edited designs adhere to the semantic constraints of the `DesignSystem` and meet accessibility standards. This subsystem acts as a bridge between high-level design intent (e.g., "use the primary color") and the concrete properties of nodes on the canvas.

## Design Rules Engine

The Rules Engine is responsible for the automated enforcement of design consistency. It operates primarily through the `applyRules` function, which traverses a frame's node hierarchy and applies corrective logic based on the active `DesignSystem.rules`.

### DesignRule Types
Rules are defined as objects within the `DesignSystem` and typically fall into three categories:
- **`primary-button-token`**: Enforces that any node identified as a "button" uses the `primary` color token for its fill [src/designsystem/rules.ts:23-35]().
- **`card-radius`**: Synchronizes the `radius` property of rectangles and images with a global design system value [src/designsystem/rules.ts:36-51]().
- **`min-tap-target`**: An accessibility rule that ensures interactive elements (buttons, inputs) meet a minimum height requirement (e.g., 40px or 44px) [src/designsystem/rules.ts:52-62]().

### Auto-fix Pipeline
The `applyRules` function implements an auto-fix pipeline. When the AI generates a new frame or a user modifies a component, the system runs this pipeline to ensure compliance.

#### Rule Application Data Flow
The following diagram illustrates how the `applyRules` function processes a `Frame` and generates `RuleViolation` logs.

```mermaid
graph TD
  subgraph "Rule Application Logic"
    "applyRules"[applyRules] --> "fixNode"[fixNode Recursive]
    "fixNode" --> "checkRules"["Iterate ds.rules"]
    "checkRules" --> "Rule_Primary"["primary-button-token"]
    "checkRules" --> "Rule_Radius"["card-radius"]
    "checkRules" --> "Rule_Tap"["min-tap-target"]
  end

  "Input_Frame"["Frame Object"] --> "applyRules"
  "DesignSystem"["DesignSystem.rules"] --> "applyRules"

  "Rule_Primary" -- "If type='button' && fill != 'primary'" --> "Fix_Fill"["Update node.style.fill"]
  "Rule_Radius" -- "If type='rect' && radius != rule.value" --> "Fix_Radius"["Update node.style.radius"]
  "Rule_Tap" -- "If height < rule.value" --> "Fix_Height"["Update node.height"]

  "Fix_Fill" --> "Violation"["RuleViolation Log"]
  "Fix_Radius" --> "Violation"
  "Fix_Height" --> "Violation"

  "fixNode" -- "Recursive Map" --> "Output_Frame"["Fixed Frame"]
```
**Sources:** [src/designsystem/rules.ts:14-69](), [src/__tests__/core.test.ts:72-102]()

## Design System Audit

While the Rules Engine fixes specific nodes, the Audit system evaluates the health and completeness of the `DesignSystem` itself. It is designed to act as a "Senior PM / Designer" check [src/designsystem/audit.ts:29-33]().

### AuditFinding Levels
Findings are categorized into three levels:
- `ok`: Requirement met or best practice followed.
- `warn`: Minor inconsistency or missing non-critical scale (e.g., missing elevation levels).
- `error`: Critical deficiency (e.g., missing mandatory semantic colors).

### Key Audit Metrics
The `auditDesignSystem` function performs the following checks:

| Check | Logic | Target / Requirement |
| :--- | :--- | :--- |
| **Semantic Completeness** | Verifies existence of specific keys in `tokens.colors` | `primary`, `bg`, `surface`, `border`, `text`, `muted` [src/designsystem/audit.ts:39-45]() |
| **WCAG Contrast** | Calculates contrast ratio between `primary` and `primary-fg` | Ratio ≥ 4.5:1 (WCAG AA) [src/designsystem/audit.ts:47-60]() |
| **Type Scale** | Counts entries in `tokens.fonts.sizes` | Recommended ≥ 4 levels [src/designsystem/audit.ts:62-69]() |
| **Spacing Scale** | Counts entries in `tokens.spacing` | Recommended ≥ 4 levels [src/designsystem/audit.ts:70-76]() |
| **Elevation** | Verifies `tokens.elevation` | Recommended ≥ 2 levels [src/designsystem/audit.ts:83-87]() |

### Contrast Calculation
The system implements standard WCAG relative luminance formulas to determine accessibility compliance [src/designsystem/audit.ts:9-27]().

```mermaid
graph LR
  "hexColor"["Hex Color String"] --> "luminance"["luminance()"]
  "luminance" --> "sRGB"["Normalize 0..255 to 0..1"]
  "sRGB" --> "Pow"["Apply Gamma Correction (v^2.4)"]
  "Pow" --> "L"["0.2126*R + 0.7152*G + 0.0722*B"]
  "L" --> "contrastRatio"["contrastRatio(L1, L2)"]
  "contrastRatio" --> "Result"["(hi + 0.05) / (lo + 0.05)"]
```
**Sources:** [src/designsystem/audit.ts:8-27]()

## Integration with AI Generation

Design rules are deeply integrated into the AI generation workflow to ensure that the output of Large Language Models (LLMs) or local heuristics is immediately usable and on-brand.

1.  **Local Generation**: The `generateFrameFromMarkdown` utility uses the `DesignSystem` to map generic element names (like "Login Button") to specific node types and default tokenized styles [src/__tests__/core.test.ts:59-70]().
2.  **Post-Processing**: Immediately after a frame is generated by the AI (via `generatePage` or `generateFlow`), `applyRules` is called to "clean up" the output, ensuring all buttons use the primary token and interactive elements are large enough for touch [src/designsystem/rules.ts:14-17]().
3.  **Token Binding**: During the `fixNode` process, hardcoded hex values are replaced with token references (e.g., `{ type: "token", token: "primary" }`), which ensures that if the design system tokens are updated later, the AI-generated screens update automatically [src/designsystem/rules.ts:27]().

### System Architecture: Rules & Audit
The following diagram bridges the Natural Language concepts (Rules/Audit) to the Code Entities.

```mermaid
classDiagram
    class DesignSystem {
        +DesignTokens tokens
        +DesignRule[] rules
    }
    class DesignRule {
        +string id
        +string kind
        +number|string value
    }
    class RuleViolation {
        +string ruleId
        +string nodeId
        +string message
        +boolean fixed
    }
    class AuditFinding {
        +string level
        +string message
    }

    DesignSystem "1" *-- "many" DesignRule
    
    class RulesEngine {
        <<Utility>>
        +applyRules(Frame, DesignSystem) : {frame, violations}
    }
    
    class AuditEngine {
        <<Utility>>
        +auditDesignSystem(DesignSystem) : AuditFinding[]
        +contrastRatio(hex, hex) : number
    }

    RulesEngine ..> RuleViolation : creates
    AuditEngine ..> AuditFinding : creates
    RulesEngine ..> DesignRule : reads
```
**Sources:** [src/designsystem/rules.ts:3-17](), [src/designsystem/audit.ts:3-6](), [src/schema/types.ts]() (implied)

## Implementation Details

### Node Traversal
The `applyRules` function uses a recursive `fixNode` inner function to ensure that rules are applied to nested children within groups or frames [src/designsystem/rules.ts:20-66]().

### Rule Customization
Rules are not hardcoded; they respect the `value` field within the `DesignRule` object. For example, if a user updates the `card-radius` rule in the `DesignSystem` to `12`, subsequent calls to `applyRules` will automatically adjust rectangles to `12px` [src/__tests__/core.test.ts:104-125]().

**Sources:**
- [src/designsystem/rules.ts:1-70]()
- [src/designsystem/audit.ts:1-91]()
- [src/__tests__/core.test.ts:72-126]()
- [src/interop/importDesign.ts:1-29]() (context for token structures)

---
