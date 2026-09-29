import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTutorial } from './useTutorial'
import { authApi } from '../api/client'

vi.mock('../api/client', () => ({
  authApi: {
    completeTutorial: vi.fn().mockResolvedValue({ success: true }),
  },
}))

const store = {}
const mockLocalStorage = {
  getItem: vi.fn((key) => store[key] || null),
  setItem: vi.fn((key, val) => { store[key] = String(val) }),
  removeItem: vi.fn((key) => { delete store[key] }),
  clear: vi.fn(() => { for (const k in store) delete store[k] }),
}
globalThis.localStorage = mockLocalStorage

describe('useTutorial Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('provides 8 steps for standard student/member users including library and style modules', () => {
    const { openTutorial, steps, currentStep } = useTutorial()
    openTutorial({ role: 'student', mandatory: true })

    expect(steps.value.length).toBe(8)
    expect(steps.value[0].id).toBe('home')
    expect(steps.value[1].id).toBe('schedule')
    expect(steps.value[2].id).toBe('arxiv')
    expect(steps.value[3].id).toBe('library')
    expect(steps.value[4].id).toBe('resources')
    expect(steps.value[5].id).toBe('mailbox')
    expect(steps.value[6].id).toBe('assistant')
    expect(steps.value[7].id).toBe('style')
    expect(currentStep.value.id).toBe('home')

    // 确保 AI 助手步骤纯粹聚焦于 /assistant 工作台，绝不跳转配置页面打扰导览背景
    const assistantStep = steps.value.find(s => s.id === 'assistant')
    expect(assistantStep).toBeDefined()
    expect(assistantStep.targetRoute).toBe('/assistant')
    expect(assistantStep.subSteps.every(sub => sub.targetRoute === '/assistant' || sub.id === 'assistant_nav')).toBe(true)
    expect(assistantStep.subSteps.some(sub => sub.targetRoute === '/account')).toBe(false)
  })

  it('provides 13 steps for administrators including admin features', () => {
    const { openTutorial, steps } = useTutorial()
    openTutorial({ role: 'admin', mandatory: false })

    expect(steps.value.length).toBe(13)
    const adminStepIds = steps.value.slice(8).map(s => s.id)
    expect(adminStepIds).toEqual([
      'admin_branding',
      'admin_members',
      'admin_invites',
      'admin_notices',
      'admin_moderation',
    ])
    expect(steps.value.slice(8).every(s => s.isAdmin === true)).toBe(true)
  })

  it('navigates through steps correctly with nextStep and prevStep', () => {
    const { openTutorial, currentStepIndex, isFirstStep, isLastStep, nextStep, prevStep } = useTutorial()
    openTutorial({ role: 'student' })

    expect(currentStepIndex.value).toBe(0)
    expect(isFirstStep.value).toBe(true)
    expect(isLastStep.value).toBe(false)

    nextStep()
    expect(currentStepIndex.value).toBe(1)
    expect(isFirstStep.value).toBe(false)

    prevStep()
    expect(currentStepIndex.value).toBe(0)
    expect(isFirstStep.value).toBe(true)
  })

  it('calculates progress percentage accurately', () => {
    const { openTutorial, currentStepIndex, progressPercent, nextStep } = useTutorial()
    openTutorial({ role: 'student' }) // 8 steps

    expect(progressPercent.value).toBe(13) // round(1/8 * 100) = 13
    nextStep()
    expect(progressPercent.value).toBe(25) // round(2/8 * 100) = 25
  })

  it('completes tutorial, calls API and updates localStorage cache', async () => {
    localStorage.setItem('labhub_user', JSON.stringify({ id: 1, tutorial_completed: false }))

    const { openTutorial, finishTutorial, showTutorial } = useTutorial()
    openTutorial({ role: 'student' })
    expect(showTutorial.value).toBe(true)

    await finishTutorial()

    expect(authApi.completeTutorial).toHaveBeenCalledTimes(1)
    expect(showTutorial.value).toBe(false)

    const updated = JSON.parse(localStorage.getItem('labhub_user'))
    expect(updated.tutorial_completed).toBe(true)
  })

  it('provides sub-steps with sidebar pinning as the initial action', () => {
    const { openTutorial, currentSubStep, currentStep } = useTutorial()
    openTutorial({ role: 'student' })

    expect(currentStep.value.id).toBe('home')
    expect(currentSubStep.value.id).toBe('home_pin_sidebar')
    expect(currentSubStep.value.targetId).toBe('tour-pin-sidebar')
    expect(currentSubStep.value.requiresClick).toBe(true)
  })

  it('traverses through sub-steps across module boundaries using nextSubStep and prevSubStep', () => {
    const { openTutorial, currentStepIndex, currentSubStepIndex, currentSubStep, nextSubStep, prevSubStep } = useTutorial()
    openTutorial({ role: 'student' })

    expect(currentStepIndex.value).toBe(0)
    expect(currentSubStepIndex.value).toBe(0)

    // Step 0 has 5 subSteps (0 to 4)
    nextSubStep()
    expect(currentSubStepIndex.value).toBe(1)
    expect(currentSubStep.value.id).toBe('home_actions')

    // Advance to end of step 0
    nextSubStep() // 2: marquee
    nextSubStep() // 3: week
    nextSubStep() // 4: next meeting
    expect(currentSubStepIndex.value).toBe(4)

    // Crossing boundary to step 1 (schedule)
    nextSubStep()
    expect(currentStepIndex.value).toBe(1)
    expect(currentSubStepIndex.value).toBe(0)
    expect(currentSubStep.value.id).toBe('schedule_nav')

    // Go back across boundary
    prevSubStep()
    expect(currentStepIndex.value).toBe(0)
    expect(currentSubStepIndex.value).toBe(4)
  })

  it('allows skipping the tutorial anytime via skipTutorial', async () => {
    const { openTutorial, skipTutorial, showTutorial } = useTutorial()
    openTutorial({ role: 'student' })
    expect(showTutorial.value).toBe(true)

    await skipTutorial()
    expect(showTutorial.value).toBe(false)
    expect(authApi.completeTutorial).toHaveBeenCalledTimes(1)
  })

  it('allows dynamically switching user role via setUserRole and recomputes steps', () => {
    const { openTutorial, userRole, setUserRole, steps, isFirstStep } = useTutorial()
    openTutorial({ role: 'student' })

    expect(isFirstStep.value).toBe(true)
    expect(userRole.value).toBe('student')
    expect(steps.value.length).toBe(8)

    // Switch to admin
    setUserRole('admin')
    expect(userRole.value).toBe('admin')
    expect(steps.value.length).toBe(13)
    expect(steps.value.some(s => s.isAdmin)).toBe(true)
    expect(isFirstStep.value).toBe(true)

    // Switch back to member
    setUserRole('member')
    expect(userRole.value).toBe('member')
    expect(steps.value.length).toBe(8)
    expect(steps.value.some(s => s.isAdmin)).toBe(false)
  })
})

