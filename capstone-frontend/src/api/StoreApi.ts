import { useCrudApi } from "../utils/fetch"

// Interface for the Store object
export interface Store {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  user_id: number;
  created_at: string;
  updated_at: string;
}

// Interface for creating a new store
export interface CreateStoreDTO {
  name: string;
  description: string;
}

// Interface for updating an existing store
export interface UpdateStoreDTO {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export function useStoreApi() {
  const httpClient = useCrudApi();

  // 1. POST /api/stores (Seller) - Create a new store
  async function createStore(storeData: CreateStoreDTO): Promise<Store> {
    return httpClient.postItem("/stores", storeData);
  }

  // 2. GET /api/stores/me (Seller) - Get stores for the current user
  async function getMyStores(): Promise<Store[]> {
    return httpClient.getItems("/stores/me");
  }

  // 3. GET /api/stores/:id (Admin) - Get store details by ID
  async function getStoreByIdAdmin(id: number): Promise<Store> {
    return httpClient.getItems(`/stores/${id}`);
  }

  // 4. PUT /api/stores/:id (Owner/Admin) - Update a store
  async function updateStore(id: number, storeData: UpdateStoreDTO): Promise<Store> {
    return httpClient.putItem(`/stores/$z{id}`, storeData);
  }

  // 5. DELETE /api/stores/:id (Owner/Admin) - Delete a store (soft delete)
  async function deleteStore(id: number): Promise<void> {
    return httpClient.deleteItem(`/stores/${id}`);
  }

  // 6. GET /api/stores (Public) - Get all active stores
  async function getAllPublicStores(): Promise<Store[]> {
    return httpClient.getItems("/stores");
  }

  // 7. GET /api/stores/:id/public (Buyer/Public) - Get public store details by ID
  async function getPublicStoreById(id: number): Promise<Store> {
    return httpClient.getItems(`/stores/${id}/public`);
  }

  return {
    createStore,
    getMyStores,
    getStoreByIdAdmin,
    updateStore,
    deleteStore,
    getAllPublicStores,
    getPublicStoreById,
  };
}
