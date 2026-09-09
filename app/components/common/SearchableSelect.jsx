'use client';
import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

/**
 * SearchableSelect — Custom select có search, animation, đẹp hơn native select
 *
 * Props:
 *  - options: [{ value, label, description? }]
 *  - value: string
 *  - onChange: (value) => void
 *  - placeholder?: string
 *  - searchPlaceholder?: string
 *  - disabled?: boolean
 *  - clearable?: boolean  — hiện nút X để xóa
 */
export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Chọn...',
    searchPlaceholder = 'Tìm kiếm...',
    disabled = false,
    clearable = false,
    positionFixed = false, // true khi dùng trong Modal để tránh dropdown bị clip
}) {
    const [open, setOpen]     = useState(false);
    const [query, setQuery]   = useState('');
    const containerRef        = useRef(null);
    const searchRef           = useRef(null);
    const listRef             = useRef(null);
    const uid                 = useId();
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

    const selected = options.find((o) => o.value === value) || null;

    const filtered = query.trim()
        ? options.filter(
              (o) =>
                  o.label.toLowerCase().includes(query.toLowerCase()) ||
                  o.description?.toLowerCase().includes(query.toLowerCase()),
          )
        : options;

    // Tính vị trí dropdown khi dùng positionFixed
    const updateDropdownPos = () => {
        if (!positionFixed || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPos({
            top:   rect.bottom + 4,
            left:  rect.left,
            width: rect.width,
        });
    };

    // Đóng khi click ngoài
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus ô search khi mở
    useEffect(() => {
        if (open) {
            updateDropdownPos();
            setTimeout(() => searchRef.current?.focus(), 50);
            setQuery('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Scroll item được chọn vào view khi mở
    useEffect(() => {
        if (open && listRef.current && selected) {
            const el = listRef.current.querySelector(`[data-value="${selected.value}"]`);
            el?.scrollIntoView({ block: 'nearest' });
        }
    }, [open, selected]);

    const handleSelect = (opt) => {
        onChange(opt.value);
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }} id={uid}>

            {/* ── Trigger ───────────────────────────────────────────── */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((v) => !v)}
                onKeyDown={handleKeyDown}
                aria-haspopup="listbox"
                aria-expanded={open}
                style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    width:          '100%',
                    height:         40,
                    padding:        '0 11px',
                    border:         open ? '1px solid #4096ff' : '1px solid #d9d9d9',
                    borderRadius:   6,
                    background:     disabled ? '#f5f5f5' : '#fff',
                    cursor:         disabled ? 'not-allowed' : 'pointer',
                    color:          selected ? '#000' : '#bfbfbf',
                    fontSize:       14,
                    boxShadow:      open ? '0 0 0 2px rgba(5,145,255,.1)' : 'none',
                    transition:     'border-color .2s, box-shadow .2s',
                    outline:        'none',
                    gap:            8,
                }}
            >
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected ? selected.label : placeholder}
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {clearable && selected && (
                        <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); onChange(null); }}
                            style={{ display: 'flex', color: '#bfbfbf', padding: 2, cursor: 'pointer', borderRadius: 3 }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#888')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#bfbfbf')}
                        >
                            <X size={13} />
                        </span>
                    )}
                    <span
                        style={{
                            display:    'flex',
                            color:      '#8c8c8c',
                            transition: 'transform .2s',
                            transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                    >
                        <ChevronDown size={15} />
                    </span>
                </span>
            </button>

            {/* ── Dropdown ──────────────────────────────────────────── */}
            {open && (
                <div
                    style={{
                        position:     positionFixed ? 'fixed' : 'absolute',
                        top:          positionFixed ? dropdownPos.top  : 'calc(100% + 4px)',
                        left:         positionFixed ? dropdownPos.left : 0,
                        right:        positionFixed ? 'auto'           : 0,
                        width:        positionFixed ? dropdownPos.width : undefined,
                        zIndex:       9999,
                        background:   '#fff',
                        border:       '1px solid #e8e8e8',
                        borderRadius: 8,
                        boxShadow:    '0 6px 24px rgba(0,0,0,.12)',
                        overflow:     'hidden',
                        animation:    'ss-open .15s ease',
                    }}
                >
                    <style>{`
                        @keyframes ss-open {
                            from { opacity:0; transform:translateY(-6px); }
                            to   { opacity:1; transform:translateY(0);    }
                        }
                        .ss-item:hover  { background: #f0f7ff !important; }
                        .ss-item:active { background: #d6eaff !important; }
                    `}</style>

                    {/* Search input */}
                    {options.length > 4 && (
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                            <div
                                style={{
                                    display:     'flex',
                                    alignItems:  'center',
                                    gap:         6,
                                    background:  '#fafafa',
                                    border:      '1px solid #e8e8e8',
                                    borderRadius: 6,
                                    padding:     '0 8px',
                                }}
                            >
                                <Search size={13} color="#8c8c8c" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    style={{
                                        flex:       1,
                                        height:     30,
                                        border:     'none',
                                        background: 'transparent',
                                        outline:    'none',
                                        fontSize:   13,
                                        color:      '#262626',
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') setOpen(false);
                                        if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0]);
                                    }}
                                />
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery('')}
                                        style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#bfbfbf' }}
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* List */}
                    <ul
                        ref={listRef}
                        role="listbox"
                        style={{
                            margin:    0,
                            padding:   '4px 0',
                            listStyle: 'none',
                            maxHeight: 220,
                            overflowY: 'auto',
                        }}
                    >
                        {filtered.length === 0 ? (
                            <li style={{ padding: '10px 16px', color: '#8c8c8c', fontSize: 13, textAlign: 'center' }}>
                                Không tìm thấy
                            </li>
                        ) : (
                            filtered.map((opt) => {
                                const isActive = opt.value === value;
                                return (
                                    <li
                                        key={opt.value}
                                        data-value={opt.value}
                                        role="option"
                                        aria-selected={isActive}
                                        className="ss-item"
                                        onClick={() => handleSelect(opt)}
                                        style={{
                                            display:    'flex',
                                            alignItems: 'center',
                                            gap:        8,
                                            padding:    '8px 12px',
                                            cursor:     'pointer',
                                            background: isActive ? '#e6f4ff' : 'transparent',
                                            transition: 'background .12s',
                                        }}
                                    >
                                        <span style={{ flex: 1, fontSize: 14, color: isActive ? '#1677ff' : '#262626', fontWeight: isActive ? 600 : 400 }}>
                                            {opt.label}
                                        </span>
                                        {isActive && <Check size={14} color="#1677ff" style={{ flexShrink: 0 }} />}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
