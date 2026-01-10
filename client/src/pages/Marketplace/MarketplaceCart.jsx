/**
 * Marketplace Cart Page
 * Shopping cart and checkout for marketplace items
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Puzzle, ClipboardList, Link2, Palette, Package } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MarketplaceCart = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('marketplace_cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error parsing cart:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Save cart to localStorage
    localStorage.setItem('marketplace_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const removeItem = (itemId) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const getSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price || 0), 0);
  };

  const getPlatformFee = () => {
    return 0; // No fee for buyers
  };

  const getTotal = () => {
    return getSubtotal() + getPlatformFee();
  };

  const handleCheckout = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (cartItems.length === 0) {
      return;
    }

    try {
      setProcessing(true);

      // Process each item
      for (const item of cartItems) {
        const response = await fetch(`${API_URL}/api/marketplace/${item.slug}/purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || `Failed to purchase ${item.name}`);
        }
      }

      // Clear cart
      setCartItems([]);
      localStorage.removeItem('marketplace_cart');

      // Redirect to purchases
      alert(t('marketplace.checkoutSuccess', 'Purchase completed successfully!'));
      navigate('/marketplace/my/purchases');
    } catch (error) {
      alert(error.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  const getTypeIcon = (itemType) => {
    const icons = { plugin: Puzzle, template: ClipboardList, integration: Link2, theme: Palette };
    const Icon = icons[itemType] || Package;
    return <Icon size={18} />;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>{t('marketplace.cart', 'Shopping Cart')}</h1>
        <button style={styles.continueButton} onClick={() => navigate('/marketplace')}>
          {t('marketplace.continueShopping', 'Continue Shopping')}
        </button>
      </header>

      {cartItems.length === 0 ? (
        <div style={styles.emptyCart}>
          <span style={styles.emptyIcon}>🛒</span>
          <h2 style={styles.emptyTitle}>{t('marketplace.emptyCart', 'Your cart is empty')}</h2>
          <p style={styles.emptyText}>
            {t('marketplace.emptyCartDesc', 'Browse our marketplace to find plugins, templates, and more!')}
          </p>
          <button style={styles.browseButton} onClick={() => navigate('/marketplace')}>
            {t('marketplace.browseMarketplace', 'Browse Marketplace')}
          </button>
        </div>
      ) : (
        <div style={styles.cartContent}>
          <div style={styles.cartItems}>
            <h2 style={styles.sectionTitle}>
              {t('marketplace.items', 'Items')} ({cartItems.length})
            </h2>

            {cartItems.map(item => (
              <div key={item.id} style={styles.cartItem}>
                <div style={styles.itemIcon}>
                  {item.icon_url ? (
                    <img src={item.icon_url} alt={item.name} style={styles.iconImage} />
                  ) : (
                    <span style={styles.iconEmoji}>{getTypeIcon(item.type)}</span>
                  )}
                </div>
                <div style={styles.itemInfo}>
                  <h3 style={styles.itemName}>{item.name}</h3>
                  <p style={styles.itemType}>{item.type}</p>
                  <p style={styles.itemSeller}>
                    {t('marketplace.by', 'by')} {item.seller_name || 'Unknown'}
                  </p>
                </div>
                <div style={styles.itemActions}>
                  <span style={styles.itemPrice}>
                    {item.price === 0 ? t('marketplace.free', 'Free') : `$${item.price.toFixed(2)}`}
                  </span>
                  <button
                    style={styles.removeButton}
                    onClick={() => removeItem(item.id)}
                  >
                    {t('common.remove', 'Remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.orderSummary}>
            <h2 style={styles.sectionTitle}>{t('marketplace.orderSummary', 'Order Summary')}</h2>

            <div style={styles.summaryRow}>
              <span>{t('marketplace.subtotal', 'Subtotal')}</span>
              <span>${getSubtotal().toFixed(2)}</span>
            </div>

            <div style={styles.summaryRow}>
              <span>{t('marketplace.processingFee', 'Processing Fee')}</span>
              <span>${getPlatformFee().toFixed(2)}</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryTotal}>
              <span>{t('marketplace.total', 'Total')}</span>
              <span style={styles.totalAmount}>${getTotal().toFixed(2)}</span>
            </div>

            <button
              style={styles.checkoutButton}
              onClick={handleCheckout}
              disabled={processing || cartItems.length === 0}
            >
              {processing
                ? t('common.processing', 'Processing...')
                : t('marketplace.proceedToCheckout', 'Proceed to Checkout')
              }
            </button>

            <p style={styles.secureNote}>
              🔒 {t('marketplace.secureCheckout', 'Secure checkout powered by Stripe')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  continueButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  emptyCart: {
    textAlign: 'center',
    padding: '80px 20px',
    backgroundColor: 'white',
    borderRadius: '12px'
  },
  emptyIcon: {
    fontSize: '64px',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  emptyText: {
    margin: '0 0 24px 0',
    fontSize: '16px',
    color: '#6b7280'
  },
  browseButton: {
    padding: '14px 32px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cartContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    gap: '32px',
    alignItems: 'flex-start'
  },
  cartItems: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  cartItem: {
    display: 'flex',
    gap: '16px',
    padding: '16px 0',
    borderBottom: '1px solid #e5e7eb',
    alignItems: 'center'
  },
  itemIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  iconImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '12px'
  },
  iconEmoji: {
    fontSize: '28px'
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  itemType: {
    margin: '0 0 4px 0',
    fontSize: '13px',
    color: '#3b82f6',
    textTransform: 'capitalize'
  },
  itemSeller: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280'
  },
  itemActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px'
  },
  itemPrice: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  removeButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    color: '#ef4444',
    fontSize: '13px',
    cursor: 'pointer'
  },
  orderSummary: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    position: 'sticky',
    top: '24px'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    fontSize: '14px',
    color: '#6b7280'
  },
  summaryDivider: {
    height: '1px',
    backgroundColor: '#e5e7eb',
    margin: '16px 0'
  },
  summaryTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '24px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  totalAmount: {
    fontSize: '24px',
    color: '#10b981'
  },
  checkoutButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '16px'
  },
  secureNote: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#6b7280',
    margin: 0
  }
};

export default MarketplaceCart;
