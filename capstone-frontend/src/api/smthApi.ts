// api/smthApi.ts
import { useCrudApi } from "../utils/fetch"

export interface IndexRequest {
  teamId?: string
  positionId?: string
  text?: string
}

export interface Phone {
  phoneId: string
  phoneNumber: string
}

export interface IndexResponse {
  id: string
  dateOfBirth: string
  email: string
  firstname: string
  lastname: string
  phones: Phone[]
  positionId: string
  teamId: string
}

export function useSmthApi() {
  const httpClient = useCrudApi()

  async function getIndex(data: IndexRequest): Promise<IndexResponse[]> {
    return httpClient.postItem("/Smth/Index", data)
  }

  async function create(params: IndexResponse): Promise<string> {
    return httpClient.postItem("/Smth/Create", params)
  }

  async function update(params: IndexResponse): Promise<string> {
    return httpClient.postItem("/Smth/Update", params)
  }

  async function getDetail(param: string): Promise<IndexResponse> {
    // ทำให้โค้ดง่ายขึ้นโดยใช้ template literal
    return httpClient.getItems(`/Smth/GetDetail?id=${param}`)
  }

  async function deleteSmth(id: string): Promise<string> {
    return httpClient.postItem("/Smth/Delete", { id })
  }

  return { getIndex, create, update, getDetail, deleteSmth }
}
