// Implementação do `GeoAdapter` para o app Daqui: fala com o backend :8000
// usando o token do usuário logado, então a busca de endereço já vem filtrada
// pro bairro dele e o reverse geocoding devolve o bairro resolvido.
// (O painel ads-admin tem seu próprio adapter, apontando pro ads-backend.)

import { api } from './api';
import { GeoAdapter } from './geoProvider';

export const daquiGeoAdapter: GeoAdapter = {
  searchAddress: (query) => api.searchAddress(query),
  resolveLocation: (latitude, longitude) => api.resolveNeighborhood(latitude, longitude),
};
