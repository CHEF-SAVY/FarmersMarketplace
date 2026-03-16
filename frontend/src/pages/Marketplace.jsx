import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const s = {
  page: { maxWidth: 1100, margin: '0 auto', padding: 24 },
  title: { fontSize: 24, fontWeight: 700, color: '#2d6a4f', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 24, fontSize: 15 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 },
  card: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 8px #0001', cursor: 'pointer', transition: 'transform 0.1s', border: '2px solid transparent' },
  name: { fontWeight: 700, fontSize: 16, marginBottom: 4 },
  farmer: { fontSize: 12, color: '#888', marginBottom: 8 },
  desc: { fontSize: 13, color: '#555', marginBottom: 12, minHeight: 36 },
  price: { fontWeight: 700, color: '#2d6a4f', fontSize: 18 },
  qty: { fontSize: 12, color: '#888', marginTop: 4 },
  empty: { textAlign: 'center', padding: 60, color: '#888' },
};

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.getProducts().then(setProducts).catch(() => {}); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.farmer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.page}>
      <div style={s.title}>🛒 Marketplace</div>
      <div style={s.sub}>Fresh produce directly from local farmers</div>
      <input
        placeholder="Search products or farmers..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd', width: 300, marginBottom: 24, fontSize: 14 }}
      />
      {filtered.length === 0 ? (
        <div style={s.empty}>No products found.</div>
      ) : (
        <div style={s.grid}>
          {filtered.map(p => (
            <div key={p.id} style={s.card} onClick={() => navigate(`/product/${p.id}`)}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🥬</div>
              <div style={s.name}>{p.name}</div>
              <div style={s.farmer}>by {p.farmer_name}</div>
              <div style={s.desc}>{p.description || 'Fresh from the farm'}</div>
              <div style={s.price}>{p.price} XLM <span style={{ fontSize: 13, fontWeight: 400 }}>/ {p.unit}</span></div>
              <div style={s.qty}>{p.quantity} {p.unit} available</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
