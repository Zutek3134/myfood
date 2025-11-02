const imgLazyLoading = {
    initLazyLoading() {
        document.getElementsByTagName("head")[0].insertAdjacentHTML("beforeend", "<link href='/js/imgLazyLoading/stylesheet.css' rel='stylesheet'></link>");

        if (!("IntersectionObserver" in window)) {
            this.advancedLazyLoading = false;
            return;
        }

        this.advancedLazyLoading = true;
        this.lazyImageObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            const newImg = new Image();
                            newImg.onerror = function () {
                                if (img.parentElement.classList.contains('clickable-image'))
                                    img.parentElement.parentElement.remove();
                                else
                                    img.parentElement.remove();
                            }
                            newImg.onload = function () {
                                img.src = img.dataset.src;

                                setTimeout(() => {
                                    img.parentElement.classList.add('loaded');
                                    img.removeAttribute("data-src");
                                }, 300);
                            };
                            newImg.src = img.dataset.src;
                            this.lazyImageObserver.unobserve(img);
                        }
                    }
                });
            },
            { threshold: 0.1, rootMargin: "0px 0px 100px 0px" }
        );
    },

    bulkLoadLazyImg() {
        const lazyImages = document.querySelectorAll(".lazy-image-container img");
        lazyImages.forEach(img => this.loadLazyImg(img));
    },

    loadLazyImg(img) {
        if (this.advancedLazyLoading) {
            this.lazyImageObserver.observe(img);
        } else {
            if (img.dataset.src) {
                img.src = img.dataset.src;

                setTimeout(() => {
                    img.parentElement.classList.add('loaded');
                    img.removeAttribute("data-src");
                }, 300);
            }
        }
    }
}

window.loadLazyImg = (...args) => imgLazyLoading.loadLazyImg(...args);
window.bulkLoadLazyImg = (...args) => imgLazyLoading.bulkLoadLazyImg(...args);
document.addEventListener('DOMContentLoaded', () => imgLazyLoading.initLazyLoading());