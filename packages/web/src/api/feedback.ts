import { client } from './client'
import type { FeedbackEntity, CreateFeedbackDto, UpdateFeedbackDto } from '@kms/shared'

export const feedbackApi = {
  list(params?: { status?: string; category?: string }) {
    return client.get<FeedbackEntity[]>('/feedback', { params })
  },

  getById(id: string) {
    return client.get<FeedbackEntity>(`/feedback/${id}`)
  },

  create(data: CreateFeedbackDto) {
    return client.post<FeedbackEntity>('/feedback', data)
  },

  update(id: string, data: UpdateFeedbackDto) {
    return client.patch<FeedbackEntity>(`/feedback/${id}`, data)
  },
}
