(defn set-id [id item]
  (if (element? item)
    (replace-nth item 0 (keyword (str (name (first item)) "#" id)))))

(defn artboard [bounds & body]
  [:artboard bounds
   (let
    [$size (rect/size bounds)
     [$width $height] $size
     background (fn [c] (fill c (rect [0 0] $size)))
     frame-guide (guide/stroke (rect [.5 .5] (vec2/- $size [1 1])))]
     (translate (rect/point bounds)
                (g [frame-guide] body)))])

(defn find-item [sel body]
  (first
   (find-list  #(= (first %) sel) body)))

(defn guide/stroke [& xs]
  (if (zero? (count xs))
    (stroke $guide-color)
    (stroke $guide-color (first xs))))

(defmacro g
  [attrs & xs]
  (let [_attrs (gensym)
        _attr-transform (gensym)
        _attr-style (gensym)]
    `(let [~_attrs ~attrs
           ~_attr-transform (get ~_attrs :transform)
           ~_attr-style (get ~_attrs :style)]

       (cond
         (and ~_attr-transform ~_attr-style)
         ~`(transform ~_attr-transform ~`(style ~_attr-style ~@xs))

         ~_attr-transform
         ~`(transform ~_attr-transform ~@xs)

         ~_attr-style
         ~`(style ~_attr-style ~@xs)

         :else
         (vec ~xs)))))

(defmacro transform
  [matrix & xs]
  (let [m (gensym)]
    `(let [~m ~matrix]
       (binding [$transform (mat2d/* $transform ~m)]
         ~`[:transform ~m ~@xs]))))

;; (defn gen-style-binds [style]
;;   (apply concat
;;          (map
;;           (fn [[k v]]
;;             [(symbol (str "$" (name k))) v])
;;           (entries style))))
;;           
;; (defmacro
;;   style
;;   [attrs & xs]
;;   (let [eval-attrs (eval-in-env attrs)
;;         binds (if (sequential? eval-attrs)
;;                 (apply concat (map gen-style-binds eval-attrs))
;;                 (gen-style-binds eval-attrs))]
;;     `(binding ~binds
;;        ~(vec `(:style ~attrs ~@xs)))))

(defn style
  [attrs & xs]
  `[:style ~attrs ~@xs])


;; Color
(defn color
  {:doc "Creates a color string"}
  [& xs]
  (case (count xs)
    1 (let [v (first xs)]
        (if (number? v)
          (color/gray v)
          v))
    3 (apply color/rgb xs)
    "black"))

(defn color? [x]
  (string? x))

(defn color/gray
  {:returns {:type "color"}}
  [v]
  (def b (* v 255))
  (format "rgb(%f,%f,%f)" b b b))

(defn color/rgb
  {:params [{:label "Red" :type "number"}
            {:label "Green" :type "number"}
            {:label "Blue" :type "number"}]
   :returns {:type "color"}}
  [r g b]
  (format "rgb(%f,%f,%f)" (* r 255) (* g 255) (* b 255)))

(defn color/hsl
  {:params [{:label "Hue" :type "number"}
            {:label "Saturation" :type "number"}
            {:label "Lightness" :type "number"}]
   :returns {:type "color"}}
  [h s l]
  (format "rgb(%f,%f,%f)" (* (mod h 1) 360) (* s 100) (* l 100)))

(defmacro background
  [color]
  `(do
     (def $background ~color)
     (vector :background ~color)))

(def background
  (with-meta background
    {:doc "Fill the entire view or artboard with a color"
     :params [{:type "color" :desc "A background color"}]}))

(defn enable-animation
  [& xs] (concat :enable-animation xs))

(defn element? [a] (and (sequential? a) (keyword? (first a))))

(defn column
  {:doc "Returns a vector of nums from *start* to *end* (both inclusive) that each of element is multiplied by *step*"
   :params [{:type "number" :desc "From"}
            {:type "number" :desc "To"}
            {:type "number" :desc "Step"}]}
  [from to step]
  (vec (map #(* % step) (range from (inc to)))))

;; Transform
(defmacro  view-center
  {:doc "Returns a translation matrix to move the origin onto the center of view or artboard"
   :returns {:type "mat2d"}
   :handles {:draw (fn [_ mat]
                     [{:type "point" :class "translate" :pos (take 4 mat)}])}}

  []
  `(translate (vec2/scale $size .5)))

;; Style
(defn fill
  {:doc "Creates a fill property"
   :params [{:label "Color" :type "color" :desc "Color to fill"}]}
  [color]
  {:fill true :fill-color color})

(defn stroke
  {:doc "Creates a stroke property"
   :params [{:label "Color" :type "color"}
            {:label "Width" :default 1 :type "number" :constraints {:min 0}}
            &
            {:keys [{:key :cap :type "string" :default "round"
                     :enum ["butt" "round" "square"]}
                    {:key :join :type "string" :default "round"
                     :enum ["bevel" "round" "miter"]}]}]}
  [color & args]
  (let [params (case (count args)
                 0 {}
                 1 {:width (first args)}
                 (apply hash-map (concat :width args)))]
    (->> params
         (seq params)
         (map (fn [[k v]] [(keyword (str "stroke-" (name k))) v]))
         (apply concat [:stroke true :stroke-color color])
         (apply hash-map))))

; (defn linear-gradient
;   {:doc "Define a linear gradient style to apply to fill or stroke"}
;   [x1 y1 x2 y2 & xs]
;   (let [args (apply hash-map xs)]
;     (if (not (contains? args :stops))
;       (throw "[linear-gradient] odd number of arguments")
;       (vector :linear-gradient
;               (hash-map :points (vector x1 y1 x2 y2)
;                         :stops (get args :stops))))))

;; Shape Functions
(defn text
  {:doc "Generate a text shape"
   :params [{:type "string" :desc "the alphanumeric symbols to be displayed"}
            {:type "vec2"}
            &
            {:keys [{:key :size :type "number" :default 12}
                    {:key :font :type "string" :default "Fira Code"}
                    {:key :align :type "string" :default "center"
                     :enum ["left" "center" "right" "start" "end"]}
                    {:key :baseline :type "string" :default "middle"
                     :enum ["top" "hanging" "middle"
                            "alphabetic" "ideographic" "bottom"]}]}]
   :handles {:draw (fn [[_ pos & xs]]
                     (let [args (apply hash-map xs)
                           size (get args :size 12)]
                       [{:id :pos
                         :type "point"
                         :class "translate"
                         :pos pos}
                        {:id :size
                         :type "path"
                         :path (ngon pos size 4)}]))
             :on-drag (fn [{:id id :pos p} params]
                        (case id
                          :pos (replace-nth params 1 p)
                          :size (let [text-pos (take 2 params)
                                      dir (vec2/- (nth params 1) p)
                                      size (+ (abs (.x dir)) (abs (.y dir)))
                                      args (->> (take 2 params)
                                                (apply hash-map)
                                                (#(assoc % :size size))
                                                (entries)
                                                (apply concat))]
                                  (concat text-pos args))))}}
  [text pos & xs]
  [:text text pos (apply hash-map xs)])
