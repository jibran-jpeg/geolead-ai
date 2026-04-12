import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { draftInGmail } from '../../utils/exportUtils';
import { Mail, MessageSquare, Copy, Pencil, Save, X, Globe, Star, MapPin, Phone, Instagram } from 'lucide-react';

export default function EmailPreview() {
    const { selectedLead, showEmailPreview, closeEmailPreview, showToast, updateLeadPitch, updateLeadSmsPitch } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('email');
    const [editedEmail, setEditedEmail] = useState('');
    const [editedSms, setEditedSms] = useState('');

    useEffect(() => {
        if (selectedLead) {
            setEditedEmail(selectedLead.pitch || '');
            setEditedSms(selectedLead.smsPitch || '');

            if (selectedLead.smsPitch && !selectedLead.pitch) {
                setActiveTab('sms');
            } else {
                setActiveTab('email');
            }
            setIsEditing(false);
        }
    }, [selectedLead]);

    if (!showEmailPreview || !selectedLead) return null;

    const hasEmail = !!selectedLead.pitch || (isEditing && activeTab === 'email');
    const hasSms = !!selectedLead.smsPitch || (isEditing && activeTab === 'sms');

    if (!hasEmail && !hasSms && !isEditing) {
        return (
            <div className="modal-overlay" onClick={closeEmailPreview}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <div>
                            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <MessageSquare size={14} /> Pitch Preview
                            </div>
                        </div>
                        <button className="modal-close" onClick={closeEmailPreview}>
                            <X size={14} />
                        </button>
                    </div>
                    <div className="modal-body">No pitch generated yet.</div>
                </div>
            </div>
        );
    }

    const currentText = activeTab === 'email'
        ? (isEditing ? editedEmail : selectedLead.pitch)
        : (isEditing ? editedSms : selectedLead.smsPitch);

    const handleCopy = () => {
        navigator.clipboard.writeText(currentText || '').then(() => {
            showToast('Copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy', 'error');
        });
    };

    const handleGmail = () => {
        draftInGmail(selectedLead);
        showToast('Opening Gmail draft...', 'success');
    };

    const handleWhatsApp = () => {
        if (!selectedLead.phone) {
            showToast('No phone number available', 'error');
            return;
        }
        const phone = selectedLead.phone.replace(/\D/g, '');
        const text = encodeURIComponent(selectedLead.smsPitch || '');
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
        showToast('Opening WhatsApp...', 'success');
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (activeTab === 'email') {
            updateLeadPitch(selectedLead.id, editedEmail, 'GENERATED');
        } else {
            updateLeadSmsPitch(selectedLead.id, editedSms);
        }
        setIsEditing(false);
        showToast('Pitch updated!', 'success');
    };

    return (
        <div className="modal-overlay" onClick={closeEmailPreview}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {hasEmail && hasSms ? (
                                <><Mail size={14} /><MessageSquare size={14} /> Dual Pitch Preview</>
                            ) : hasSms ? (
                                <><MessageSquare size={14} /> SMS / WhatsApp Pitch</>
                            ) : (
                                <><Mail size={14} /> Email Pitch</>
                            )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            For: {selectedLead.businessName}
                        </div>
                    </div>
                    <button className="modal-close" onClick={closeEmailPreview}>
                        <X size={14} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Lead Info */}
                    <div style={{
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 10px',
                        marginBottom: '12px',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={10} /> {selectedLead.address || 'N/A'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={10} /> {selectedLead.phone || 'N/A'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={10} /> {selectedLead.website || 'No website'}</span>
                        {selectedLead.instagram && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Instagram size={10} /> {selectedLead.instagram.replace('https://www.instagram.com/', '@').replace('https://instagram.com/', '@').replace(/\/$/, '')}</span>
                        )}
                        {selectedLead.rating && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={10} fill="currentColor" style={{ color: 'var(--warning)' }} /> {selectedLead.rating} ({selectedLead.reviewCount || 0})</span>
                        )}
                    </div>

                    {/* Tabs for Dual Pitch */}
                    {hasEmail && hasSms && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <div
                                onClick={() => setActiveTab('email')}
                                style={{
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: activeTab === 'email' ? '600' : '400',
                                    color: activeTab === 'email' ? 'var(--primary)' : 'var(--text-muted)',
                                    borderBottom: activeTab === 'email' ? '2px solid var(--primary)' : '2px solid transparent',
                                    paddingBottom: '4px',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <Mail size={12} /> Email
                            </div>
                            <div
                                onClick={() => setActiveTab('sms')}
                                style={{
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: activeTab === 'sms' ? '600' : '400',
                                    color: activeTab === 'sms' ? 'var(--primary)' : 'var(--text-muted)',
                                    borderBottom: activeTab === 'sms' ? '2px solid var(--primary)' : '2px solid transparent',
                                    paddingBottom: '4px',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <MessageSquare size={12} /> WhatsApp / SMS
                            </div>
                        </div>
                    )}

                    {/* Pitch Content */}
                    {isEditing ? (
                        <textarea
                            value={activeTab === 'email' ? editedEmail : editedSms}
                            onChange={(e) => activeTab === 'email' ? setEditedEmail(e.target.value) : setEditedSms(e.target.value)}
                            style={{
                                width: '100%',
                                minHeight: activeTab === 'email' ? '160px' : '100px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--primary)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px',
                                color: 'var(--text-primary)',
                                fontFamily: "'Inter', sans-serif",
                                fontSize: '12px',
                                lineHeight: '1.7',
                                resize: 'vertical',
                                outline: 'none',
                            }}
                        />
                    ) : (
                        <div className="email-preview" style={{ minHeight: activeTab === 'sms' ? '80px' : '160px' }}>
                            {currentText}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {isEditing ? (
                        <>
                            <button className="btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                            <button className="btn-secondary" onClick={handleSaveEdit} style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Save size={12} /> Save
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn-secondary" onClick={handleEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Pencil size={12} /> Edit
                            </button>
                            <button className="btn-secondary" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Copy size={12} /> Copy
                            </button>

                            {activeTab === 'email' && hasEmail && (
                                <button className="btn-secondary" onClick={handleGmail} style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Mail size={12} /> Gmail
                                </button>
                            )}

                            {activeTab === 'sms' && hasSms && selectedLead.phone && (
                                <button className="btn-secondary" onClick={handleWhatsApp} style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MessageSquare size={12} /> WhatsApp
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
