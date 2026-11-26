// Kampanya hedefini MongoDB filtresine çevirir.
// İlçe seçimi sadece o ilçenin bağlı olduğu il için geçerlidir: hedef "Antalya (Gazipaşa) + İzmir" ise
// Antalya'dan sadece Gazipaşa, İzmir'den tüm ilçeler hedeftedir.
import { listDistricts } from './locations.js';

export function targetFilter(target = {}) {
  const provinces = target.provinces ?? [];
  const districts = target.districts ?? [];
  const filter = {};
  if (target.categories?.length) filter.category = { $in: target.categories };

  if (provinces.length) {
    filter.$or = provinces.map((province) => {
      const own = listDistricts(province) ?? [];
      const selected = districts.filter((d) => own.includes(d));
      return selected.length
        ? { 'location.province': province, 'location.district': { $in: selected } }
        : { 'location.province': province };
    });
  } else if (districts.length) {
    filter['location.district'] = { $in: districts };
  }
  return filter;
}
