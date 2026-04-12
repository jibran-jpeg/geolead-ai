import React, { useState } from 'react';
import { CATEGORIES } from '../../utils/categories';
import useStore from '../store/useStore';

export default function CategorySelector() {
    const { selectedCategories, toggleCategory, selectAllCategories, deselectAllCategories } = useStore();
    const [isExpanded, setIsExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCategories = CATEGORIES.filter(c =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const allSelected = selectedCategories.length === CATEGORIES.length;

    const handleToggleAll = () => {
        if (allSelected) {
            deselectAllCategories();
        } else {
            selectAllCategories(CATEGORIES.map(c => c.id));
        }
    };

    return (
        <div className="component-card">
            <div
                className="flex-between header-cursor"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ cursor: 'pointer', marginBottom: isExpanded ? '10px' : '0' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="section-title" style={{ margin: 0 }}>Select Categories</div>
                    <span className="badge-count">
                        {selectedCategories.length}/{CATEGORIES.length}
                    </span>
                </div>
                <button className="btn-icon-minimal" style={{ padding: '4px' }}>
                    {isExpanded ? '▼' : '▶'}
                </button>
            </div>

            {isExpanded && (
                <div className="collapsible-content">
                    <input
                        type="text"
                        className="category-search-input"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />

                    <div className="category-grid">
                        {filteredCategories.map((cat) => {
                            const isSelected = selectedCategories.includes(cat.id);
                            return (
                                <label
                                    key={cat.id}
                                    className={`category-checkbox ${isSelected ? 'selected' : ''}`}
                                    htmlFor={`cat-${cat.id}`}
                                >
                                    <input
                                        type="checkbox"
                                        id={`cat-${cat.id}`}
                                        checked={isSelected}
                                        onChange={() => toggleCategory(cat.id)}
                                    />
                                    <span className="category-check">
                                        <span className="category-check-icon">✓</span>
                                    </span>
                                    <span className="category-icon">{cat.icon}</span>
                                    <span className="text-truncate">{cat.label}</span>
                                </label>
                            );
                        })}
                        {filteredCategories.length > 0 && (
                            <button className="category-select-all" onClick={handleToggleAll}>
                                {allSelected ? '✕ Deselect All' : '✓ Select All'}
                            </button>
                        )}
                        {filteredCategories.length === 0 && (
                            <div style={{ gridColumn: 'span 2', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '10px 0' }}>
                                No categories found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
