import { setup, assign } from 'xstate';

/**
 * Commerce State Machine
 * 
 * Purpose: Control UI state, navigation flows, and user journey
 * Does NOT handle: Products, cart, checkout (that's ShopifyContext)
 * 
 * Responsibilities:
 * - Track which view/screen user is on
 * - Control modal open/close state
 * - Persist scroll position
 * - Remember which product user was viewing
 * - Manage filter/view selection (All/Desserts/Merchandise)
 * - Control behavioral flows (browsing → product → cart → checkout)
 */

// ===== INITIAL CONTEXT =====
const initialContext = {
    // UI State - What's happening on screen
    view: 'All', // 'All' | 'Desserts' | 'Merchandise'
    
    // Navigation - Where user is in the flow
    selectedProductId: null, // Which product is selected
    showProductModal: false, // Is product modal open
    showCartBanner: false, // Is cart summary banner visible
    showCartDrawer: false, // Is cart drawer open
    
    // Scroll Position - Persist scroll
    scrollPosition: 0,
    
    // User Journey Tracking
    lastViewedProducts: [], // Track last 5 products viewed
    
    // Error handling
    error: null,
};

// ===== STATE MACHINE =====
export const commerceMachine = setup({
    actions: {
        // Reset to initial state
        resetContext: assign(() => initialContext),
        
        // Set view filter
        setView: assign(({ context, event }) => {
            if (event.type !== 'SET_VIEW') return context;
            return {
                ...context,
                view: event.view
            };
        }),
        
        // Open product modal
        openProductModal: assign(({ context, event }) => {
            console.log('🔧 Machine: openProductModal action called');
            console.log('🔧 Event:', event);
            console.log('🔧 Current context.selectedProductId:', context.selectedProductId);
            
            if (event.type !== 'VIEW_PRODUCT') return context;
            
            // Ensure productId is always a string, not an object
            const productId = typeof event.productId === 'string' 
                ? event.productId 
                : event.productId?.id || String(event.productId);
            
            console.log('🔧 Setting selectedProductId to:', productId);
            console.log('🔧 Type:', typeof productId);
            
            // Add to recently viewed (max 5)
            const recentlyViewed = [
                productId,
                ...context.lastViewedProducts.filter(id => id !== productId)
            ].slice(0, 5);
            
            return {
                ...context,
                selectedProductId: productId,
                showProductModal: true,
                lastViewedProducts: recentlyViewed
            };
        }),
        
        // Close product modal
        closeProductModal: assign(({ context }) => ({
            ...context,
            showProductModal: false,
            // Don't clear selectedProductId - keep it for persistence
        })),
        
        // Clear selected product (when navigating away)
        clearSelectedProduct: assign(({ context }) => ({
            ...context,
            selectedProductId: null,
            showProductModal: false
        })),
        
        // Show cart banner after adding to cart
        showCartBanner: assign(({ context }) => ({
            ...context,
            showCartBanner: true,
            showProductModal: false // Close product modal when showing banner
        })),
        
        // Hide cart banner
        hideCartBanner: assign(({ context }) => ({
            ...context,
            showCartBanner: false
        })),
        
        // Show/hide cart drawer
        openCartDrawer: assign(({ context }) => {
            console.log('🛒 openCartDrawer action called');
            return {
                ...context,
                showCartDrawer: true,
                showCartBanner: false, // Hide banner when opening drawer
            };
        }),
        
        closeCartDrawer: assign(({ context }) => ({
            ...context,
            showCartDrawer: false
        })),
        
        // Save scroll position
        saveScrollPosition: assign(({ context, event }) => {
            if (event.type !== 'SET_SCROLL_POSITION') return context;
            return {
                ...context,
                scrollPosition: event.position
            };
        }),
        
        // Set error
        setError: assign(({ context }, params) => ({
            ...context,
            error: params.error
        })),
        
        // Clear error
        clearError: assign(({ context }) => ({
            ...context,
            error: null
        }))
    },
    
    guards: {
        // Check if product modal is open
        isProductModalOpen: ({ context }) => context.showProductModal,
        
        // Check if cart banner is visible
        isCartBannerVisible: ({ context }) => context.showCartBanner
    }
}).createMachine({
    id: 'commerce',
    initial: 'browsing',
    context: initialContext,
    
    states: {
        // Main browsing state
        browsing: {
            initial: 'idle',
            states: {
                idle: {
                    on: {
                        VIEW_PRODUCT: {
                            target: 'viewingProduct',
                            actions: 'openProductModal'
                        },
                        SET_VIEW: {
                            actions: 'setView'
                        },
                        SET_SCROLL_POSITION: {
                            actions: 'saveScrollPosition'
                        },
                        ADDED_TO_CART: {
                            actions: 'openCartDrawer'
                        },
                        OPEN_CART: {
                            actions: 'openCartDrawer'
                        },
                        CLOSE_CART: {
                            actions: 'closeCartDrawer'
                        }
                    }
                },
                
                viewingProduct: {
                    on: {
                        VIEW_PRODUCT: {
                            target: 'viewingProduct',
                            actions: 'openProductModal'
                        },
                        CLOSE_PRODUCT: {
                            target: 'idle',
                            actions: 'closeProductModal'
                        },
                        ADDED_TO_CART: {
                            target: 'idle',
                            actions: ['closeProductModal', 'openCartDrawer']
                        },
                        GO_BACK: {
                            target: 'idle',
                            actions: 'closeProductModal'
                        },
                        OPEN_CART: {
                            target: 'idle',
                            actions: ['closeProductModal', 'openCartDrawer']
                        },
                        CLOSE_CART: {
                            actions: 'closeCartDrawer'
                        }
                    }
                },
                
                showingCartBanner: {
                    on: {
                        CLOSE_CART_BANNER: {
                            target: 'idle',
                            actions: 'hideCartBanner'
                        },
                        VIEW_PRODUCT: {
                            target: 'viewingProduct',
                            actions: ['hideCartBanner', 'openProductModal']
                        },
                        GO_TO_CHECKOUT: {
                            target: '#commerce.checkout',
                            actions: 'hideCartBanner'
                        },
                        OPEN_CART: {
                            target: 'idle',
                            actions: 'openCartDrawer'
                        },
                        CLOSE_CART: {
                            actions: 'closeCartDrawer'
                        }
                    }
                }
            }
        },
        
        // Checkout flow state
        checkout: {
            on: {
                BACK_FROM_CHECKOUT: {
                    target: 'browsing',
                    actions: 'clearError'
                },
                GO_BACK: {
                    target: 'browsing',
                    actions: 'clearError'
                }
            }
        }
    },
    
    on: {
        // Global transitions
        RESET: {
            target: '.browsing',
            actions: 'resetContext'
        }
    }
});
