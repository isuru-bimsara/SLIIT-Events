import React, { useEffect, useState } from 'react';
import merchService from '../../services/merchService';
import eventService from '../../services/eventService';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatCurrency';

const makeBlankBank = () => ({ bankName: '', accountName: '', accountNumber: '', branch: '' });
const makeBlankSize = () => ({ size: '', quantity: '' });

// NEW: keep newest items first
const sortByNewest = (list = []) =>
  [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

const AddMerchandise = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [banks, setBanks] = useState([makeBlankBank()]);
  const [bankErrors, setBankErrors] = useState(['']);

  const [form, setForm] = useState({
    name: '',
    venue: '',
    price: '',
    totalQuantity: '',
    merchImage: null,
  });

  const [errors, setErrors] = useState({ price: '', totalQuantity: '' });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [hasSizes, setHasSizes] = useState(false);
  const [sizes, setSizes] = useState([makeBlankSize()]);
  const [sizeErrors, setSizeErrors] = useState(['']);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const resp = await eventService.getEvents({ page: 1, limit: 500 });
        const evts = resp?.data?.data || resp?.data || resp;
        const mine = (evts || []).filter((e) => {
          const ownerId = typeof e.createdBy === 'string' ? e.createdBy : e.createdBy?._id;
          return ownerId === user?._id;
        });
        setEvents(mine);
        if (mine[0]) setSelectedEvent(mine[0]._id);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Unable to load events');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    const loadItems = async () => {
      if (!selectedEvent) return;
      const list = await merchService.getEventMerch(selectedEvent);
      setItems(sortByNewest(list)); // NEW
    };
    loadItems();
  }, [selectedEvent]);

  const handleNumberField = (field, value, min = 0) => {
    if (!/^\d*$/.test(value)) {
      setErrors((e) => ({ ...e, [field]: 'Numbers only' }));
    } else if (value !== '' && Number(value) < min) {
      setErrors((e) => ({ ...e, [field]: `Must be ≥ ${min}` }));
    } else {
      setErrors((e) => ({ ...e, [field]: '' }));
    }
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleBankChange = (idx, field, val) => {
    setBanks((prev) => {
      const next = prev.map((b) => ({ ...b }));
      next[idx][field] = val;
      return next;
    });
    if (field === 'accountNumber') {
      setBankErrors((prev) => {
        const next = [...prev];
        next[idx] = /^\d*$/.test(val) ? '' : 'Digits only';
        return next;
      });
    }
  };

  const addBank = () => {
    setBanks((b) => [...b.map((x) => ({ ...x })), makeBlankBank()]);
    setBankErrors((e) => [...e, '']);
  };

  const removeBank = (idx) => {
    setBanks((b) => b.filter((_, i) => i !== idx));
    setBankErrors((e) => e.filter((_, i) => i !== idx));
  };

  const handleSizeChange = (idx, field, val) => {
    setSizes((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next[idx][field] = val;
      return next;
    });

    if (field === 'quantity') {
      setSizeErrors((prev) => {
        const next = [...prev];
        next[idx] = /^\d*$/.test(val) ? '' : 'Digits only';
        return next;
      });
    }
  };

  const addSize = () => {
    setSizes((prev) => [...prev, makeBlankSize()]);
    setSizeErrors((prev) => [...prev, '']);
  };

  const removeSize = (idx) => {
    setSizes((prev) => prev.filter((_, i) => i !== idx));
    setSizeErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const getCleanSizes = () =>
    sizes
      .map((s) => ({ size: s.size.trim(), quantity: Number(s.quantity || 0) }))
      .filter((s) => s.size);

  const hasSizeValidationErrors = () => {
    if (!hasSizes) return false;
    if (sizeErrors.some(Boolean)) return true;

    const clean = getCleanSizes();
    if (clean.length === 0) return true;
    if (clean.some((s) => !Number.isFinite(s.quantity) || s.quantity <= 0)) return true;

    const set = new Set(clean.map((s) => s.size.toLowerCase()));
    if (set.size !== clean.length) return true; // duplicate sizes

    return false;
  };

  const resetForm = () => {
    setForm({ name: '', venue: '', price: '', totalQuantity: '', merchImage: null });
    setErrors({ price: '', totalQuantity: '' });

    setBanks([makeBlankBank()]);
    setBankErrors(['']);

    setHasSizes(false);
    setSizes([makeBlankSize()]);
    setSizeErrors(['']);

    setPreview(null);
    setEditingId(null);
  };

  const onFileChange = (file) => {
    setForm((f) => ({ ...f, merchImage: file }));
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const hasErrors = () => errors.price || errors.totalQuantity || bankErrors.some((e) => e);

  const submit = async (e) => {
    e.preventDefault();

    if (!selectedEvent) return toast.error('Select an event');
    if (hasErrors()) return toast.error('Fix validation errors first');
    if (hasSizeValidationErrors()) {
      return toast.error('Fix size rows (valid qty + no duplicates)');
    }

    setSaving(true);
    try {
      const cleanSizes = hasSizes ? getCleanSizes() : [];

      const payload = {
        eventId: selectedEvent,
        name: form.name,
        venue: form.venue,
        price: form.price,
        totalQuantity: form.totalQuantity,
        hasSizes,
        sizes: cleanSizes,
        bankDetails: banks,
        merchImage: form.merchImage,
      };

      let saved = null;
      if (editingId) {
        saved = await merchService.updateMerch(editingId, payload);
        toast.success('Merchandise updated');
      } else {
        saved = await merchService.createMerch(payload);
        toast.success('Merchandise created');
      }

      resetForm();

      // NEW: instant newest-first UI update for create
      if (!editingId && saved?._id) {
        setItems((prev) => sortByNewest([saved, ...prev.filter((x) => x._id !== saved._id)]));
      } else {
        const list = await merchService.getEventMerch(selectedEvent);
        setItems(sortByNewest(list));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save merchandise');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      venue: item.venue,
      price: item.price,
      totalQuantity: item.totalQuantity,
      merchImage: null,
    });

    setBanks(item.bankDetails?.length ? item.bankDetails.map((b) => ({ ...b })) : [makeBlankBank()]);
    setBankErrors(item.bankDetails?.map(() => '') || ['']);
    setPreview(item.image || null);

    setHasSizes(!!item.hasSizes);
    if (item.hasSizes && item.sizes?.length) {
      setSizes(item.sizes.map((s) => ({ size: s.size, quantity: String(s.quantity) })));
      setSizeErrors(item.sizes.map(() => ''));
    } else {
      setSizes([makeBlankSize()]);
      setSizeErrors(['']);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    await merchService.deleteMerch(id);
    toast.success('Deleted');
    setItems((prev) => prev.filter((m) => m._id !== id));
    if (editingId === id) resetForm();
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Merchandise</h1>
          <p className="text-sm text-dark-500">Create, edit, and delete merchandise per event.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl mx-auto">
        <div className="bg-slate-50 border-b border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800">
            {editingId ? 'Edit Product Item' : 'Create New Listing'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Provide accurate details for the event marketplace.</p>
        </div>

        <form onSubmit={submit} className="p-6 md:p-8 space-y-8">
          <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-4">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Product Image</label>
              <div className="relative group w-full aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-blue-400">
                {preview ? (
                  <>
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm font-medium">Change Image</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <div className="text-slate-400 mb-2">📸</div>
                    <p className="text-xs text-slate-500">Click to upload high-res image</p>
                  </div>
                )}
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={(e) => onFileChange(e.target.files[0])}
                />
              </div>
            </div>

            <div className="md:col-span-7 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Associated Event *</label>
                <select
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-all"
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  required
                >
                  <option value="" disabled>Select the event</option>
                  {events.map((ev) => (
                    <option key={ev._id} value={ev._id}>{ev.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Item Name *</label>
                <input
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="e.g. Official Club Jersey"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Price (LKR)</label>
                  <input
                    className={`w-full h-11 px-4 rounded-lg border outline-none transition-all ${
                      errors.price ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                    }`}
                    type="text"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => handleNumberField('price', e.target.value, 0)}
                    required
                  />
                  {errors.price && <p className="text-[10px] text-red-600 font-medium">{errors.price}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    {hasSizes ? 'Base Stock Qty (auto from sizes)' : 'Stock Qty'}
                  </label>
                  <input
                    className={`w-full h-11 px-4 rounded-lg border outline-none transition-all ${
                      errors.totalQuantity ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                    }`}
                    type="text"
                    inputMode="numeric"
                    value={form.totalQuantity}
                    onChange={(e) => handleNumberField('totalQuantity', e.target.value, 1)}
                    required={!hasSizes}
                    disabled={hasSizes}
                  />
                  {errors.totalQuantity && <p className="text-[10px] text-red-600 font-medium">{errors.totalQuantity}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase">Pickup Venue *</label>
              <input
                className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Detailed location for pickup"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                required
              />
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={hasSizes}
                  onChange={(e) => setHasSizes(e.target.checked)}
                />
                This product has sizes
              </label>

              {hasSizes && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">Sizes & Quantities</h4>
                    <button
                      type="button"
                      onClick={addSize}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      + ADD SIZE
                    </button>
                  </div>

                  {sizes.map((s, idx) => (
                    <div key={idx} className="grid md:grid-cols-2 gap-3">
                      <input
                        className="bg-white border border-slate-200 rounded-md h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Size (e.g. XL, Small)"
                        value={s.size}
                        onChange={(e) => handleSizeChange(idx, 'size', e.target.value)}
                        required={hasSizes}
                      />
                      <div className="space-y-1">
                        <input
                          className={`bg-white border rounded-md h-10 px-3 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none ${
                            sizeErrors[idx] ? 'border-red-400' : 'border-slate-200'
                          }`}
                          placeholder="Quantity"
                          inputMode="numeric"
                          value={s.quantity}
                          onChange={(e) => handleSizeChange(idx, 'quantity', e.target.value)}
                          required={hasSizes}
                        />
                        {sizeErrors[idx] && <p className="text-[10px] text-red-500">{sizeErrors[idx]}</p>}
                      </div>

                      {sizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSize(idx)}
                          className="text-xs text-red-500 text-right md:col-span-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>🏦</span> Bank Settlement Accounts
                </h4>
                <button
                  type="button"
                  onClick={addBank}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  + ADD ANOTHER BANK
                </button>
              </div>

              <div className="grid gap-4">
                {banks.map((b, idx) => (
                  <div key={idx} className="group relative bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all">
                    <div className="grid md:grid-cols-4 gap-4">
                      <input
                        className="bg-white border border-slate-200 rounded-md h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Bank Name"
                        value={b.bankName}
                        onChange={(e) => handleBankChange(idx, 'bankName', e.target.value)}
                        required
                      />
                      <input
                        className="bg-white border border-slate-200 rounded-md h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Account Name"
                        value={b.accountName}
                        onChange={(e) => handleBankChange(idx, 'accountName', e.target.value)}
                        required
                      />
                      <div className="space-y-1">
                        <input
                          className={`bg-white border rounded-md h-10 px-3 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none ${
                            bankErrors[idx] ? 'border-red-400' : 'border-slate-200'
                          }`}
                          placeholder="Account Number"
                          value={b.accountNumber}
                          inputMode="numeric"
                          onChange={(e) => handleBankChange(idx, 'accountNumber', e.target.value)}
                          required
                        />
                        {bankErrors[idx] && <p className="text-[10px] text-red-500">{bankErrors[idx]}</p>}
                      </div>
                      <input
                        className="bg-white border border-slate-200 rounded-md h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Branch"
                        value={b.branch}
                        onChange={(e) => handleBankChange(idx, 'branch', e.target.value)}
                      />
                    </div>

                    {banks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBank(idx)}
                        className="absolute -top-2 -right-2 bg-white border border-red-200 text-red-500 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm hover:bg-red-50"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-100">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Discard Changes
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-green-500 text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-green-800 transition-all disabled:opacity-50"
            >
              {saving ? 'Processing...' : editingId ? 'SAVE CHANGES' : 'CREATE ITEM'}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-900">Items (Newest First)</h3>
        {items.length === 0 && (
          <div className="card p-6 text-sm text-dark-500">No merchandise for this event yet.</div>
        )}

        {items.map((m) => {
          const sold = m.soldQuantity || 0;
          const total = m.totalQuantity || 0;
          const available = total - sold;

          return (
            <div key={m._id} className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex gap-3">
                <div className="h-20 w-20 rounded-xl overflow-hidden bg-dark-50 border border-dark-100">
                  {m.image ? (
                    <img src={m.image} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-dark-400">No Image</div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-dark-900">{m.name}</p>
                  <p className="text-xs text-dark-500">Venue: {m.venue}</p>
                  <p className="text-sm text-dark-500">Price: {formatCurrency(m.price)}</p>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">Sold: {sold}</span>
                    <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Total: {total}</span>
                    <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Available: {available}</span>
                  </div>

                  {m.hasSizes && m.sizes?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {m.sizes.map((s, i) => {
                        const sAvail = (s.quantity || 0) - (s.soldQuantity || 0);
                        return (
                          <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">
                            {s.size}: {sAvail}/{s.quantity}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-1">
                    {m.bankDetails?.map((b, i) => (
                      <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-dark-50 border border-dark-100 text-dark-600">
                        {b.bankName} · {b.accountName} · {b.accountNumber}{b.branch ? ` · ${b.branch}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => startEdit(m)}>Edit</Button>
                <Button variant="danger" size="sm" onClick={() => del(m._id)}>Delete</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AddMerchandise;
