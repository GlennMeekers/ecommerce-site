jQuery(document).ready(function ($) {

    // Currency global variables
    let moneySpanSelector = 'span.money';
    let currencyPickerSelector = '[name=currencies]';
    let activeCurrencySelector = '.js-active-currency';
    let currencyNoteSelector = '.js-cart-currency-note';

    let currencyPicker = {
        loadCurrency: function() {
            /* Fix for customer account pages */
            $(moneySpanSelector + ' ' + moneySpanSelector).each(function() {
                $(this).parents(moneySpanSelector).removeClass('money');
            });
        
            /* Saving the current price */
            $(moneySpanSelector).each(function() {
                $(this).attr('data-currency-'+shopCurrency, $(this).html());
            });
        
            // If there's no cookie.
            if (cookieCurrency == null) {
                if (shopCurrency !== defaultCurrency) {
                    Currency.convertAll(shopCurrency, defaultCurrency);
                }
                else {
                    Currency.currentCurrency = defaultCurrency;
                }
            }
            // If the cookie value does not correspond to any value in the currency dropdown.
            else if ($(currencyPickerSelector).length && $(currencyPickerSelector + ' option[value=' + cookieCurrency + ']').length === 0) {
                Currency.currentCurrency = shopCurrency;
                Currency.cookie.write(shopCurrency);
            }
            else if (cookieCurrency === shopCurrency) {
                Currency.currentCurrency = shopCurrency;
            }
            else {
                $(currencyPickerSelector).val(cookieCurrency);
                Currency.convertAll(shopCurrency, cookieCurrency);
            }

            currencyPicker.setCurrencyText();
        },
        onCurrencyChanged: function(event) {
            let newCurrency = $(this).val();
            let $otherPickers = $(currencyPickerSelector).not($(this));

            Currency.convertAll(Currency.currentCurrency, newCurrency);
            currencyPicker.setCurrencyText(newCurrency);

            if($otherPickers.length > 0) {
                $otherPickers.val(newCurrency);
            }
        },
        setCurrencyText: function(newCurrency = Currency.currentCurrency) {
            let $activeCurrency = $(activeCurrencySelector);
            let $currencyNote = $(currencyNoteSelector);

            if($activeCurrency.length > 0) {
                $activeCurrency.text(newCurrency);
            }

            if($currencyNote.length > 0) {
                if(newCurrency !== shopCurrency) {
                    $currencyNote.show();
                } else {
                    $currencyNote.hide();
                }
            }
        },
        onMoneySpanAdded: function() {
            Currency.convertAll(shopCurrency, Currency.currentCurrency);
            currencyPicker.setCurrencyText();
        },
        init: function() {
            if(showMultipleCurrencies !== true) {
                return false;
            }

            currencyPicker.loadCurrency();

            $(document).on('change', currencyPickerSelector, currencyPicker.onCurrencyChanged);
        }
    };

    currencyPicker.init();

    // Add to cart form
    let addToCartFormSelector = '#add-to-cart-form';
    let productOptionSelector = addToCartFormSelector + ' [name*=option]'

    let productForm = {

        onProductOptionChanged: function(event) {
            let $form = $(this).closest(addToCartFormSelector);
            selectedVariant = productForm.getActiveVariant($form);

            $form.trigger('form:change', [selectedVariant])
        },
        getActiveVariant: function($form) {
            let variants = JSON.parse(decodeURIComponent($form.attr('data-variants')));
            let formData = $form.serializeArray();
            let formOptions = {
                option1: null,
                option2: null,
                option3: null
            };
            let selectedVariant = null;

            $.each(formData, function(index, item) {
                if(item.name.indexOf('option') !== -1) {
                    formOptions[item.name] = item.value;
                }
            });

            $.each(variants, function(index, variant) {
                if(variant.option1 === formOptions.option1 && variant.option2 === formOptions.option2 && variant.option3 === formOptions.option3 ) {
                    selectedVariant = variant;
                    return false;
                }
            });
            
            return selectedVariant;

        },
        validate: function(event, selectedVariant) {
            let $form = $(this);
            let hasVariant = selectedVariant !== null;
            let canAddToCart = hasVariant && selectedVariant.inventory_quantity > 0;
            let $id = $form.find('.js-variant-id');
            let $addToCartButton = $form.find('#add-to-cart-button');
            let $price = $form.find('.js-price');
            let formattedVariantPrice;
            let priceHTML;

            if(hasVariant) {
                formattedVariantPrice = '$' + (selectedVariant.price/100).toFixed(2);
                priceHTML = '<span class="money">'+formattedVariantPrice+'</span>';

                // Adding ?variant= + variant ID to the URL when the user selects a variant and triggers a change event
                window.history.replaceState(null, null, '?variant='+selectedVariant.id);
            } else {
                priceHTML = $price.attr('data-default-price');
            }

            if(canAddToCart) {
                $id.val(selectedVariant.id);
                $addToCartButton.prop('disabled', false);
            } else {
                $id.val('');
                $addToCartButton.prop('disabled', true);
            }

            $price.html(priceHTML);
            currencyPicker.onMoneySpanAdded();
        },
        init: function() {
            $(document).on('change', productOptionSelector, productForm.onProductOptionChanged);
            $(document).on('form:change', addToCartFormSelector, productForm.validate)
        }

    };

    productForm.init();

    // AJAX API functionality
    let miniCartContentsSelector = '.js-mini-cart-contents';
    
    let ajaxify = {
        onAddToCart: function(event) {
            event.preventDefault();
    
            $.ajax({
                type: 'POST',
                url: '/cart/add.js',
                data: $(this).serialize(),
                dataType: 'json',
                success: ajaxify.onCartUpdated,
                error: ajaxify.onError
            });
        },
        onCartUpdated: function() {

            let $miniCartFieldset = $(miniCartContentsSelector + ' .js-cart-fieldset');

            $miniCartFieldset.prop('disabled', true);

            $.ajax({
                type: 'GET',
                url: '/cart',
                context: document.body,
                success: function(context) {
                    let $dataCartContents = $(context).find('.js-cart-page-contents');
                    let dataCartHtml = $dataCartContents.html();
                    let dataCartItemCount = $dataCartContents.attr('data-cart-item-count');
                    let $miniCartContents = $(miniCartContentsSelector);
                    let $cartItemCount = $('.js-cart-item-count');
    
                    $cartItemCount.text(dataCartItemCount);
                    $miniCartContents.html(dataCartHtml);
                    currencyPicker.onMoneySpanAdded();
    
                    if( parseInt(dataCartItemCount) > 0) {
                        ajaxify.openCart();
                    } else {
                        ajaxify.closeCart();
                    };
                }
            });
    
        },
        onCartButtonClick: function(event) {
            event.preventDefault();
    
            let isCartOpen = $('html').hasClass('mini-cart-open');

            if( !isCartOpen ) {
                ajaxify.openCart();
            } else {
                ajaxify.closeCart();
            }

        },
        onError: function(XMLHttpRequest, textStatus) {
            let data = XMLHttpRequest.responseJSON;
            alert(data.status + ' - ' + data.message + ': ' + data.description);
        },
        openCart: function() {
            let isInCart = window.location.href.indexOf('/cart') !== -1;
            
            if( !isInCart ) {
                $('html').addClass('mini-cart-open');
            }
        },
        closeCart: function() {
            $('html').removeClass('mini-cart-open');
        },
        init: function() {
            $(document).on('submit', addToCartFormSelector, ajaxify.onAddToCart)
            $(document).on('click', '.js-cart-link, .js-keep-shopping', ajaxify.onCartButtonClick);
        }
    };

    ajaxify.init();

    // Quantity fields
    let quantityFieldSelector = '.js-quantity-field';
    let quantityButtonSelector = '.js-quantity-button';
    let quantityPickerSelector = '.js-quantity-picker';

    let quantityPicker = {
        // Click functionality for custom plus and minus buttons
        onButtonClick: function(event) {
    
            let $button = $(this);
            let $picker = $button.closest(quantityPickerSelector);
            let $quantity = $picker.find('.js-quantity-field');
            let quantityValue = parseInt($quantity.val());
            let max = $quantity.attr('max') ? parseInt($quantity.attr('max')) : null;
    
            if($button.hasClass('plus') && (max === null || quantityValue+1 <= max )) {
                // do something for plus click
                $quantity.val(quantityValue + 1).change();
                // do something for minus click
            } else if($button.hasClass('minus')) {
                $quantity.val(quantityValue - 1).change();
            }
    
        },
        // Updating custom quantity counter '.quantity-text'
        onChange: function(event) {
    
            let $field = $(this);
            let $picker = $field.closest(quantityPickerSelector);
            let $quantityText = $picker.find('.quantity-text');
            let shouldDisableMinus = parseInt(this.value) === parseInt($field.attr('min'));
            let shouldDisablePlus = parseInt(this.value) === parseInt($field.attr('max'));
            let $minusButton = $picker.find('.js-quantity-button.minus');
            let $plusButton = $picker.find('.js-quantity-button.plus');
    
            $quantityText.text(this.value);
    
            // If quantity input field value is equal to one, disable the minus button
            if(shouldDisableMinus) {
                $minusButton.prop('disabled', true);
            } else if($minusButton.prop('disabled') === true) {
                $minusButton.prop('disabled', false);
            }
    
            // If quantity input field value is equal to its max value, disable the plus button
            if(shouldDisablePlus) {
                $plusButton.prop('disabled', true);
            } else if($plusButton.prop('disabled') === true) {
                $plusButton.prop('disabled', false);
            }
    
        },
        init: function() {
            $(document).on('click', quantityButtonSelector, quantityPicker.onButtonClick);
            $(document).on('change', quantityFieldSelector, quantityPicker.onChange);
        }
    };

    quantityPicker.init();

    // Line item
    let removeLineSelector = '.js-remove-line';
    let lineQuantitySelector = '.js-line-quantity';

    let lineItem = {
        isInMiniCart: function(element) {
            let $element = $(element);
            let $miniCart = $element.closest(miniCartContentsSelector);
            let isInMiniCart = $miniCart.lengths !== 0;

            return isInMiniCart;
        },
        onLineQuantityChanged: function(){
            let quantity = this.value;
            let id = $(this).attr('id').replace('updates_', '');
            let changes = {
                quantity: quantity,
                id: id
            };
            let isInMiniCart = lineItem.isInMiniCart(this);

            if(isInMiniCart) {
                $.post('/cart/change.js', changes, ajaxify.onCartUpdated, 'json');
            }
        },
        onLineRemoved: function(event) {
            let isInMiniCart = lineItem.isInMiniCart(this);

            if(isInMiniCart) {
                event.preventDefault();
        
                let $removeLink = $(this);
                let removeQuery = $removeLink.attr('href').split('change?')[1];
        
                $.post('/cart/change.js', removeQuery, ajaxify.onCartUpdated, 'json')
            }
        },
        init: function() {
            $(document).on('click', removeLineSelector, lineItem.onLineRemoved);
            $(document).on('change', lineQuantitySelector, lineItem.onLineQuantityChanged);
        }
    };

    lineItem.init();

    // Search input
    let searchInputSelector = '.js-search-input';
    let searchSubmitSelector = '.js-search-submit';

    onSearchInputKeyup = function(event) {
        let $form = $(this).closest('form');
        let $button = $form.find(searchSubmitSelector);
        let shouldDisableButton = this.value.length === 0;

        // If input is empty (length of 0) it will return true o=and disable the submit button
        $button.prop('disabled', shouldDisableButton);
    };

    $(document).on('keyup', searchInputSelector, onSearchInputKeyup);

    // Slideshows
    let slideSelector = '.js-slides';
    let prevButtonSelector = '.js-slider-button-prev';
    let nextButtonSelector = '.js-slider-button-next';


    // Product
    let productSlideshowSelector = '.js-product-slideshow';
    let currentSlideSelector = '.js-current-slide';
    
    let productSlideShows = {
        
        onBeforeChange: function(event, slick, currentSlide, nextSlide) {
            let $currentSlide = slick.$slider.closest(productSlideshowSelector).find(currentSlideSelector);

            $currentSlide.text(nextSlide+1)
        },
        setup: function($element) {
            let $slides = $element.find(slideSelector);
            let $prevButton = $element.find(prevButtonSelector);
            let $nextButton = $element.find(nextButtonSelector);

            productSlideshowOptions = {
                fade: true,
                nextArrow: $nextButton,
                prevArrow: $prevButton
            };

            $slides.on('beforeChange', productSlideShows.onBeforeChange).slick(productSlideshowOptions);
        },
        init: function() {
            $(productSlideshowSelector).each(function() {
                productSlideShows.setup($(this));
            })
        }
    };

    productSlideShows.init();

    // Section Slideshow
    let sectionSlideshowSelector = '.js-section-slideshow';

    let sectionSlideshows = {
        setup: function($element) {

            let $slides = $element.find(slideSelector);
            let shouldAutoplay = $element.attr('data-autoplay') === 'true';
            let autoplaySpeed = parseInt($element.attr('data-autoplay-speed'));
            let $prevButton = $element.find(prevButtonSelector);
            let $nextButton = $element.find(nextButtonSelector);

            let sectionSlideshowOptions = {
                fade: true,
                nextArrow: $nextButton,
                prevArrow: $prevButton,
                autoplay: shouldAutoplay,
                autoplaySpeed: autoplaySpeed
            };

            if ($slides.children().length > 1) {
                $slides.slick(sectionSlideshowOptions);
            }

        },
        init: function() {
            $(sectionSlideshowSelector).each(function() {
                sectionSlideshows.setup($(this));
            });
        }
        };

    sectionSlideshows.init();

})