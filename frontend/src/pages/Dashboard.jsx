import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const s = {
  page: { maxWidth: 900, margin: '0 auto', padding: 24 },
  title: { fontSize: 24, fontWeight: 700, color: '#2d6a4f', marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 8px #0001' },
  label: { display: 'block', fontSize: 13, marginBottom: 4, color: '#555' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' },
  btn: { background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  product: { borderBottom: '1px solid #eee', padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  del: { background: '#fee', color: '#c0392b', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  msg: { padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 },
  // image upload
  uploadZone: {
    border: '2px dashed #b7e4c7', borderRadius: 10, padding: '18px 12px',
    textAlign: 'center', cursor: 'pointer', marginBottom: 12,
    background: '#f8fdf9', color: '#555', fontSize: 13, transition: 'border-color 0.2s',
  },
  uploadZoneActive: { borderColor: '#2d6a4f', background: '#edf7f0' },
  preview: { width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' },
  removeImg: { background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12, marginBottom: 12 },
  imgErr: { color: '#c0392b', fontSize: 12, marginBottom: 8 },
  uploading: { color: '#888', fontSize: 12, marginBottom: 8 },
  productThumb: { width: 36, height: 36, objectFit: 'cover', borderRadius: 6, marginRight: 10, verticalAlign: 'middle' },
};

const EMPTY_FORM = { name: '', description: '', price: '', quantity: '', unit: 'kg', category: 'other' };

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [restockVals, setRestockVals] = useState({});
  const [msg, setMsg] = useState(null);

  // image state
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null); // confirmed server URL after upload
  const [imageErr, setImageErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  async function load() {
    try {
      const res = await api.getMyProducts();
      setProducts(res.data ?? res);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  function validateAndSetImage(file) {
    setImageErr('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageErr('Only JPEG, PNG, or WebP images are allowed.');
      return false;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setImageErr(`Image must be ${MAX_SIZE_MB} MB or smaller.`);
      return false;
    }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setImageUrl(null); // reset confirmed URL until uploaded
    return true;
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) validateAndSetImage(file);
    e.target.value = ''; // allow re-selecting same file
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetImage(file);
  }

  function removeImage() {
    setImageFile(null);
    setPreviewUrl(null);
    setImageUrl(null);
    setImageErr('');
  }

  async function handleAdd(e) {
    e.preventDefault();
    setMsg(null);

    // Upload image first if one is selected but not yet uploaded
    let finalImageUrl = imageUrl;
    if (imageFile && !imageUrl) {
      setUploading(true);
      try {
        const res = await api.uploadProductImage(imageFile);
        finalImageUrl = res.imageUrl;
        setImageUrl(res.imageUrl);
      } catch (err) {
        setUploading(false);
        setMsg({ type: 'err', text: `Image upload failed: ${err.message}` });
        return;
      }
      setUploading(false);
    }

    try {
      await api.createProduct({
        ...form,
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
        image_url: finalImageUrl || undefined,
      });
      setMsg({ type: 'ok', text: 'Product listed successfully' });
      setForm(EMPTY_FORM);
      removeImage();
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this product?')) return;
    try { await api.deleteProduct(id); load(); } catch {}
  }

  async function handleRestock(id) {
    const qty = parseInt(restockVals[id], 10);
    if (isNaN(qty) || qty <= 0) return alert('Enter a valid positive number to restock.');
    try {
      await api.restockProduct(id, qty);
      setRestockVals({ ...restockVals, [id]: '' });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.title}>🌾 Farmer Dashboard</div>
      <div style={s.grid}>
        <div style={s.card}>
          <h3 style={{ marginBottom: 16, color: '#333' }}>Add New Product</h3>
          {msg && (
            <div style={{ ...s.msg, background: msg.type === 'ok' ? '#d8f3dc' : '#fee', color: msg.type === 'ok' ? '#2d6a4f' : '#c0392b' }}>
              {msg.text}
            </div>
          )}
          <form onSubmit={handleAdd}>
            {[['name', 'Product Name'], ['price', 'Price (XLM)'], ['quantity', 'Quantity'], ['unit', 'Unit (kg, bunch, etc.)']].map(([key, label]) => (
              <div key={key}>
                <label style={s.label}>{label}</label>
                <input
                  style={s.input}
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  required={key !== 'unit'}
                />
              </div>
            ))}

            <label style={s.label}>Description</label>
            <textarea style={s.textarea} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

            <label style={s.label}>Category</label>
            <select style={s.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {['vegetables', 'fruits', 'grains', 'dairy', 'herbs', 'other'].map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>

            {/* Image upload */}
            <label style={s.label}>Product Image <span style={{ color: '#aaa', fontWeight: 400 }}>(optional · JPEG/PNG/WebP · max 5 MB)</span></label>

            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview" style={s.preview} />
                {uploading && <div style={s.uploading}>Uploading image...</div>}
                <button type="button" style={s.removeImg} onClick={removeImage}>✕ Remove image</button>
              </>
            ) : (
              <div
                style={{ ...s.uploadZone, ...(dragOver ? s.uploadZoneActive : {}) }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                role="button"
                aria-label="Upload product image"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                📷 Click or drag &amp; drop an image here
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {imageErr && <div style={s.imgErr}>{imageErr}</div>}

            <button style={s.btn} type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'List Product'}
            </button>
          </form>
        </div>

        <div style={s.card}>
          <h3 style={{ marginBottom: 16, color: '#333' }}>My Listings ({products.length})</h3>
          {products.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>No products yet. Add your first listing.</p>}
          {products.map(p => (
            <div key={p.id} style={s.product}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} style={s.productThumb} />
                  : <span style={{ fontSize: 28, marginRight: 10 }}>🥬</span>
                }
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>{p.price} XLM · {p.quantity} {p.unit}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  placeholder="+Qty"
                  style={{ ...s.input, width: 70, marginBottom: 0, padding: '4px 8px' }}
                  value={restockVals[p.id] || ''}
                  onChange={e => setRestockVals({ ...restockVals, [p.id]: e.target.value })}
                />
                <button
                  style={{ ...s.btn, padding: '4px 10px', fontSize: 12, background: '#218c74' }}
                  onClick={() => handleRestock(p.id)}
                >
                  Restock
                </button>
                <button style={s.del} onClick={() => handleDelete(p.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
