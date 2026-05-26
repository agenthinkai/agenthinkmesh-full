with open("client/src/pages/DealScreener.tsx", "r") as f:
    content = f.read()

# The problem:
# 1. useImperativeHandle at line ~1018 references handleFix (declared at ~1068)
# 2. early return `if (!isRejected) return null;` is at ~1066, before handleFix
#
# Solution: 
# - Remove the useImperativeHandle from its current position (after mutations)
# - Move it to AFTER handleFix is declared
# - Keep the early return BEFORE handleFix (it's fine — if not rejected, the panel doesn't render)
# - But useImperativeHandle must be called unconditionally (React rules of hooks),
#   so we must move the early return AFTER all hooks including useImperativeHandle.
#
# Correct order:
# 1. All useState
# 2. All useMutation / useQuery
# 3. handleFix (const arrow function)
# 4. useImperativeHandle (references handleFix) 
# 5. All other handlers
# 6. if (!isRejected) return null;  ← early return AFTER all hooks
# 7. return JSX

# Step 1: Remove useImperativeHandle from its current position
old_imperative = '''
  // Expose triggerFix so parent (ICReport next-step card) can call it imperatively
  React.useImperativeHandle(ref, () => ({
    triggerFix: () => { handleFix(); },
    isPending: () => fixMutation.isPending,
  }));'''

if old_imperative in content:
    content = content.replace(old_imperative, '', 1)
    print("Step 1: Removed useImperativeHandle from early position")
else:
    print("Step 1: useImperativeHandle NOT FOUND at early position")

# Step 2: Move the early return to AFTER handleFix and all other handlers
# The early return is currently: `  if (!isRejected) return null;`
# We need to move it to just before the `return (` JSX
old_early_return = '''  if (!isRejected) return null;

  const handleFix = () => {'''

new_early_return = '''  const handleFix = () => {'''

if old_early_return in content:
    content = content.replace(old_early_return, new_early_return, 1)
    print("Step 2: Removed early return from before handleFix")
else:
    print("Step 2: early return pattern NOT FOUND")

# Step 3: Add useImperativeHandle + early return AFTER handleFix declaration
# Find the end of handleFix (after setSimRunId(null);) and insert there
old_after_handlefix = '''    setOpen(true);
    setMemoText(null);
    setShowSimPrompt(false);
    setUpgradedSimData(null);
    setSimRunId(null);
  };
'''

new_after_handlefix = '''    setOpen(true);
    setMemoText(null);
    setShowSimPrompt(false);
    setUpgradedSimData(null);
    setSimRunId(null);
  };

  // Expose triggerFix so parent (ICReport next-step card) can call it imperatively
  // Must be declared AFTER handleFix (no hoisting for const arrow functions)
  React.useImperativeHandle(ref, () => ({
    triggerFix: () => { handleFix(); },
    isPending: () => fixMutation.isPending,
  }));

  // Early return — must come AFTER all hooks (React rules of hooks)
  if (!isRejected) return null;

'''

if old_after_handlefix in content:
    content = content.replace(old_after_handlefix, new_after_handlefix, 1)
    print("Step 3: useImperativeHandle and early return placed after handleFix")
else:
    print("Step 3: after-handlefix anchor NOT FOUND")

with open("client/src/pages/DealScreener.tsx", "w") as f:
    f.write(content)

print("Done.")
