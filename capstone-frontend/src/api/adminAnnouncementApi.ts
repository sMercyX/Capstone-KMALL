import { useCrudApi } from "../utils/fetch"

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  target_roles: string[];
}

export interface AnnouncementItem {
  announcement_id: number;
  admin_id: string;
  admin_display_name: string;
  title: string;
  body: string;
  target_roles: string[];
  created_at: string;
  updated_at: string;
}

export interface AnnouncementResponse {
  announcement: AnnouncementItem
}

export interface GetAnnouncementsResponse {
  announcements: AnnouncementItem[];
  pageIndex: number;
  pageSize: number;
  total: number;
}

export function useAdminAnnouncementApi() {
  const http = useCrudApi()

  async function createAnnouncement(payload: CreateAnnouncementPayload): Promise<AnnouncementResponse> {
    return http.postItem('/admin/notifications/announcements', payload)
  }

  async function getAnnouncements(page: number = 1, limit: number = 10, q: string = ""): Promise<GetAnnouncementsResponse> {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())
    if (q) params.append('q', q)
    return http.getItems(`/admin/notifications/announcements?${params.toString()}`)
  }

  async function deleteAnnouncement(id: number): Promise<{deleted: boolean}> {
    return http.deleteItem(`/admin/notifications/announcements/${id}`)
  }

  return { createAnnouncement, getAnnouncements, deleteAnnouncement }
}
