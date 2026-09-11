/**
 * FollowUp Backend API 타입
 * 출처: 백엔드의 /v3/api-docs (OpenAPI v1) — Swagger UI 는 /swagger-ui/index.html
 * 백엔드 DTO 이름을 그대로 따라가서, 명세가 바뀌면 이 파일만 고치면 되도록 한다.
 */

export type ActionItemStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type ActionItemPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type MeetingStatus = 'DRAFT' | 'CONFIRMED'
export type AnalysisStatus = 'PROCESSING' | 'GENERATED' | 'CONFIRMED' | 'FAILED'
export type ProjectRole = 'OWNER' | 'MEMBER'

export interface ErrorResponse {
  code?: string
  message?: string
}

/* ---------- Auth ---------- */
export interface SignupReqDto {
  email: string
  password: string
  name: string
}
export interface SignupResDto {
  userId: number
  email: string
  name: string
}
export interface LoginReqDto {
  email: string
  password: string
}
/** 구글 로그인 — GIS 가 발급한 ID 토큰(JWT)을 그대로 보낸다. */
export interface GoogleLoginReqDto {
  idToken: string
}
export interface TokenResDto {
  accessToken: string
  tokenType: string
  expiresIn: number
}

/* ---------- Project ---------- */
export interface ProjectCreateReqDto {
  name: string
  description?: string
}
export type ProjectUpdateReqDto = Partial<ProjectCreateReqDto>
export interface ProjectResDto {
  id: number
  name: string
  description?: string
  createdBy: number
  createdAt: string
  updatedAt: string
}

/* ---------- Project Member ---------- */
export interface ProjectMemberCreateReqDto {
  email: string
}
export interface ProjectMemberResDto {
  userId: number
  name: string
  email: string
  role: ProjectRole
  joinedAt: string
}

/* ---------- Meeting ---------- */
export interface MeetingCreateReqDto {
  title: string
  /** ISO date-time: YYYY-MM-DDTHH:mm:ss */
  scheduledAt: string
  content?: string
  participantIds?: number[]
  carryOverActionItemIds?: number[]
}
export interface MeetingUpdateReqDto {
  title?: string
  scheduledAt?: string
  content?: string
  participantIds?: number[]
}
export interface MeetingListResDto {
  id: number
  title: string
  scheduledAt: string
  status: MeetingStatus
  createdBy: number
  createdAt: string
}
export interface MeetingParticipantResDto {
  userId: number
  name: string
  email: string
}
export interface CarryOverActionItemResDto {
  actionItemId: number
  title: string
  status: ActionItemStatus
  assigneeUserId?: number
  dueDate?: string
  priority?: ActionItemPriority
}
export interface DecisionResDto {
  id: number
  content: string
  createdAt: string
}
export interface MeetingDetailResDto {
  id: number
  projectId: number
  title: string
  scheduledAt: string
  content?: string
  status: MeetingStatus
  createdBy: number
  createdAt: string
  updatedAt: string
  participants?: MeetingParticipantResDto[]
  carryOverActionItems?: CarryOverActionItemResDto[]
  decisions?: DecisionResDto[]
}

/* ---------- Action Item ---------- */
export interface ActionItemCreateReqDto {
  title: string
  description?: string
  assigneeUserId?: number | null
  /** YYYY-MM-DD */
  dueDate?: string | null
  priority?: ActionItemPriority
}
export interface ActionItemUpdateReqDto {
  title?: string
  description?: string
  assigneeUserId?: number | null
  dueDate?: string | null
  status?: ActionItemStatus
  priority?: ActionItemPriority
}
export interface ActionItemAssigneeResDto {
  userId: number
  name: string
  email: string
}
export interface ActionItemListResDto {
  id: number
  title: string
  status: ActionItemStatus
  priority?: ActionItemPriority
  assigneeUserId?: number
  dueDate?: string
  projectId: number
}
export interface ActionItemDetailResDto {
  id: number
  projectId: number
  title: string
  description?: string
  assignee?: ActionItemAssigneeResDto
  dueDate?: string
  status: ActionItemStatus
  priority?: ActionItemPriority
  priorityReason?: string
  originMeetingId?: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

/* ---------- AI Analysis ---------- */
export interface DraftDecision {
  content: string
}
export interface DraftActionItem {
  title: string
  description?: string
  /** AI 가 회의록에서 읽어낸 담당자 "이름". userId 가 아니므로 사용자가 매핑해야 한다. */
  assigneeName?: string
  dueDate?: string
  priority?: ActionItemPriority
  priorityReason?: string
}
export interface AiDraftResultDto {
  decisions?: DraftDecision[]
  actionItems?: DraftActionItem[]
}
export interface AnalysisResDto {
  id: number
  meetingId: number
  status: AnalysisStatus
  modelName?: string
  promptVersion?: string
  draft?: AiDraftResultDto
  errorMessage?: string
  createdAt: string
  confirmedAt?: string
}
export interface DecisionConfirmItem {
  content: string
}
export interface ActionItemConfirmItem {
  title: string
  description?: string
  assigneeUserId?: number | null
  dueDate?: string | null
  priority?: ActionItemPriority
  priorityReason?: string
}
export interface AnalysisConfirmReqDto {
  decisions?: DecisionConfirmItem[]
  actionItems?: ActionItemConfirmItem[]
}

/* ---------- Dashboard ---------- */
export interface ActionItemSummary {
  total: number
  todo: number
  inProgress: number
  done: number
  overdue: number
}
export interface DueSoonActionItem {
  actionItemId: number
  title: string
  status: ActionItemStatus
  priority?: ActionItemPriority
  dueDate?: string
  assigneeUserId?: number
  assigneeName?: string
}
export interface RecentMeeting {
  meetingId: number
  title: string
  scheduledAt: string
  status: MeetingStatus
}
export interface MemberProgress {
  userId: number
  name: string
  totalCount: number
  doneCount: number
  completionRate: number
}
export interface DashboardResDto {
  actionItemSummary: ActionItemSummary
  dueSoonActionItems?: DueSoonActionItem[]
  recentMeetings?: RecentMeeting[]
  memberProgress?: MemberProgress[]
}
