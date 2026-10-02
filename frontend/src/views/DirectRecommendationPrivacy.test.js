import { describe, it, expect } from 'vitest'

describe('Direct recommendation privacy rules', () => {
  const teacherUser = { id: 111, name: '李华', role: 'student', identity: 'teacher' }
  const studentUser = { id: 4, name: '陈晨', role: 'admin', identity: 'student' }
  const otherAdmin = { id: 3, name: '王思齐', role: 'admin', identity: 'student' }
  const outsider = { id: 2, name: '赵子涵', role: 'student', identity: 'student' }

  const publicPaper = {
    id: 1,
    arxiv_id: '2401.00001',
    title: 'Public Paper',
    visibility: 'public',
    recommender: teacherUser,
    recipients: []
  }

  const directPaper = {
    id: 2,
    arxiv_id: '2401.00002',
    title: 'Direct Paper for Student',
    visibility: 'direct',
    recommender: teacherUser,
    recipients: [{ id: 4, name: '陈晨' }]
  }

  function filterFeedForUser(feed, user) {
    return feed.filter((paper) => {
      if (paper.visibility === 'direct') {
        const isRecommender = (paper.recommender?.id || paper.recommended_by_id) === user.id
        const isRecipient = Array.isArray(paper.recipients) && paper.recipients.some((r) => r.id === user.id)
        return isRecommender || isRecipient
      }
      return true
    })
  }

  it('recommender can see their directional recommendation', () => {
    const visible = filterFeedForUser([publicPaper, directPaper], teacherUser)
    expect(visible.map(p => p.id)).toEqual([1, 2])
  })

  it('designated recipient can see directional recommendation', () => {
    const visible = filterFeedForUser([publicPaper, directPaper], studentUser)
    expect(visible.map(p => p.id)).toEqual([1, 2])
  })

  it('admin user who is not recipient or recommender CANNOT see directional recommendation', () => {
    const visible = filterFeedForUser([publicPaper, directPaper], otherAdmin)
    expect(visible.map(p => p.id)).toEqual([1])
    expect(visible.some(p => p.id === directPaper.id)).toBe(false)
  })

  it('outsider student CANNOT see directional recommendation', () => {
    const visible = filterFeedForUser([publicPaper, directPaper], outsider)
    expect(visible.map(p => p.id)).toEqual([1])
    expect(visible.some(p => p.id === directPaper.id)).toBe(false)
  })

  it('library filtering isolates direct paper without leaking to other users or admins', () => {
    const libraryPapers = [
      { id: 10, arxiv_id: '2401.00001', from_recommendation: 1, from_seminar: 0 },
      { id: 20, arxiv_id: '2401.00002', from_recommendation: 0, from_seminar: 0 }
    ]
    const libraryAccess = [
      { paper_id: 20, user_id: 111 },
      { paper_id: 20, user_id: 4 }
    ]

    function queryLibrary(user) {
      const allowedPaperIds = new Set(
        libraryAccess.filter(a => a.user_id === user.id).map(a => a.paper_id)
      )
      return libraryPapers.filter(lp => lp.from_recommendation === 1 || lp.from_seminar === 1 || allowedPaperIds.has(lp.id))
    }

    expect(queryLibrary(teacherUser).map(p => p.id)).toEqual([10, 20])
    expect(queryLibrary(studentUser).map(p => p.id)).toEqual([10, 20])
    expect(queryLibrary(otherAdmin).map(p => p.id)).toEqual([10])
    expect(queryLibrary(outsider).map(p => p.id)).toEqual([10])
  })

  it('canDelete only permits recommender to delete direct recommendations', () => {
    function canDelete(paper, user) {
      if (!user || !paper) return false
      const isOwner = user.id === (paper.recommender?.id || paper.recommended_by_id)
      if (paper.visibility === 'direct') {
        return isOwner
      }
      return isOwner || user.role === 'admin'
    }

    expect(canDelete(directPaper, teacherUser)).toBe(true)
    expect(canDelete(directPaper, studentUser)).toBe(false)
    expect(canDelete(directPaper, otherAdmin)).toBe(false)
    expect(canDelete(directPaper, outsider)).toBe(false)

    expect(canDelete(publicPaper, teacherUser)).toBe(true)
    expect(canDelete(publicPaper, otherAdmin)).toBe(true)
    expect(canDelete(publicPaper, outsider)).toBe(false)
  })
})
