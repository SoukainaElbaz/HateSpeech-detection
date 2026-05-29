# Hate Speech Detection using Word Embeddings

## Introduction

In Natural Language Processing (NLP), machine learning models cannot directly understand raw text. Before training a classifier, textual data must be transformed into numerical representations.

One of the most effective techniques for this transformation is **word embeddings**.

Word embeddings represent each word as a dense numerical vector in a multidimensional space, where semantically or contextually similar words are positioned close to one another.

This project explores two popular embedding techniques:

- Word2Vec
- FastText

These techniques are particularly useful for hate speech detection on tweets because social media text is highly informal, noisy, and full of slang, abbreviations, and spelling variations.

---

# 1. Word2Vec

## Definition

Word2Vec is a neural embedding model that learns vector representations of words from their surrounding context within a corpus.

The objective of Word2Vec is not text generation, but rather learning semantic relationships between words.

Words that frequently appear in similar contexts obtain similar vector representations.

---

## Training Methods

Word2Vec mainly uses two architectures:

### CBOW (Continuous Bag of Words)

CBOW predicts a target word using neighboring context words.

Example:

Context:

```text
"The cat on the mat"
```

Target:

```text
"sits"
```

---

### Skip-Gram

Skip-Gram performs the opposite task:

It predicts surrounding words from the current word.

Example:

Input:

```text
"sits"
```

Predicted context:

```text
["cat", "on"]
```

---

## Word Representation

After training, each word is represented as a numerical vector.

Example:

```python
model.wv["hate"]
```

returns a vector such as:

```python
[-0.25, 0.71, ..., 0.14]
```

If the embedding size is 100, then each word is represented in a 100-dimensional space:

```math
x \in \mathbb{R}^{100}
```

The individual numbers themselves do not have explicit meanings. Meaning emerges from the relationships and distances between vectors.

---

## Similarity Between Words

Word2Vec measures similarity using cosine similarity.

```math
\cos(\theta)=\frac{A\cdot B}{||A|| ||B||}
```

Words appearing in similar contexts obtain vectors pointing in similar directions.

Example:

```python
model.wv.most_similar("hate")
```

may return:

```python
["anger", "racism", "violence"]
```

This means the model learned contextual relationships between these words.

---

# 2. FastText

## Definition

FastText is an extension of Word2Vec developed by Facebook AI Research.

Like Word2Vec, FastText learns embeddings using CBOW or Skip-Gram objectives.

However, FastText introduces an important improvement:

Instead of treating a word as a single unit, it decomposes words into character n-grams (subwords).

---

## Subword Representation

Example:

```text
"playing"
```

may be decomposed into:

```text
pla
lay
ayi
yin
ing
```

The final embedding is constructed from these subword vectors.

---

## Advantages of FastText

FastText is highly effective for social media text because tweets often contain:

- spelling mistakes
- slang
- abbreviations
- repeated characters
- modified offensive words

Example:

```text
idiot
idiooot
idi0t
```

Word2Vec treats these as unrelated words.

FastText identifies shared character patterns and generates similar embeddings for them.

This makes FastText especially useful for hate speech detection, where users often intentionally modify offensive words to bypass moderation systems.

Example:

```text
nigga
niggaz
niggaa
```

FastText recognizes their similarity because they share common subwords.

---

# 3. Role of Embeddings in Hate Speech Detection

The purpose of embeddings in this project is to convert tweets into numerical vectors that machine learning algorithms can process.

Example tweet:

```text
"You are disgusting"
```

After tokenization, each word obtains an embedding vector.

The classifier then learns patterns associated with toxic or hateful language.

Embeddings help the model:

- capture semantic meaning
- generalize to similar insults
- recognize contextual relationships
- reduce sparsity compared to one-hot encoding

---

# 4. Why FastText is More Suitable for Tweets

Twitter data is noisy and highly informal.

Users frequently:

- misspell words
- invent slang
- stretch words
- replace letters with symbols

Example:

```text
b1tch
biatch
f@ggot
```

FastText handles these variations better because it relies on character-level information.

Therefore, FastText generally performs better than Word2Vec on social media hate speech datasets.

---

# 5. Representing an Entire Tweet

Embeddings are generated for individual words.

However, classifiers require one fixed-size vector per tweet.

A tweet containing 10 words produces 10 embedding vectors.

These vectors must therefore be combined into a single representation.

---

# 6. Average Embedding

The simplest method is averaging all word vectors.

Formula:

```math
v_{tweet}=\frac{1}{n}\sum_{i=1}^{n} v_i
```

Where:

- \(v_i\) is the embedding of word \(i\)
- \(n\) is the number of words

---

## Why Averaging Works

Embeddings already encode semantic information.

Averaging preserves the general semantic direction of the sentence.

For example:

- hateful words tend to occupy nearby regions in vector space
- averaging keeps the tweet representation near those regions

This method is:

- simple
- computationally efficient
- easy to implement
- effective as a baseline

---

# 7. Limitations of Average Embeddings

Although averaging is simple, it has several limitations.

## Loss of Word Order

The sentence:

```text
"I hate you"
```

and:

```text
"You hate I"
```

may obtain very similar vectors.

---

## Negation Problems

The sentences:

```text
"good"
```

and:

```text
"not good"
```

can become overly similar after averaging.

The method cannot correctly model sentence structure or syntax.

---

## Equal Importance for All Words

Averaging gives the same importance to every word.

However, words like:

```text
"hate"
```

should contribute more than common words such as:

```text
"the"
```

or:

```text
"is"
```

---

# 8. TF-IDF Weighted Average

To solve this issue, embeddings can be weighted using TF-IDF scores.

TF-IDF (Term Frequency–Inverse Document Frequency) assigns higher importance to informative words and lower importance to frequent common words.

The weighted embedding formula becomes:

```math
v_{tweet}=\frac{1}{n}\sum_{i=1}^{n} tfidf_i \cdot v_i
```

Where:

- \(tfidf_i\) is the TF-IDF weight of word \(i\)
- \(v_i\) is its embedding vector

---

## Advantages of TF-IDF Weighted Embeddings

This method:

- emphasizes important hateful terms
- reduces the influence of stop words
- improves semantic representation
- often increases classification performance

For hate speech detection, offensive or discriminatory terms naturally receive higher importance weights.

---

# 9. Conclusion

Word embeddings are a fundamental component of NLP-based hate speech detection systems.

Word2Vec captures contextual similarity between words, while FastText improves robustness by modeling character-level subwords.

For noisy social media data such as tweets, FastText is generally more effective because it handles slang, spelling variations, and unseen words more efficiently.

To represent complete tweets, embedding vectors can be averaged into a single feature vector. Although simple and efficient, average embeddings suffer from limitations such as loss of word order and equal weighting of all words.

TF-IDF weighted averaging partially solves these issues by assigning greater importance to informative words, leading to stronger tweet representations and improved hate speech classification performance.





























































































# Understanding TF-IDF Results

## Introduction

TF-IDF (Term Frequency–Inverse Document Frequency) is a technique used in Natural Language Processing (NLP) to measure the importance of words inside documents or tweets.

After applying TF-IDF to a dataset, two important outputs are usually generated:

- Vocabulary
- TF-IDF Matrix

Example output:

```python
Vocabulary:
['003' '007' '02' ... 'zucchini' 'zulema' 'zulu']

TF-IDF Matrix:
[[0. 0. 0. ... 0. 0. 0.]
 [0. 0. 0. ... 0. 0. 0.]
 ...
]
```

This document explains what these results mean and how they are useful for hate speech detection.

---

# 1. Vocabulary

The vocabulary contains all unique words found in the dataset after preprocessing.

Example:

```python
['hate', 'you', 'awful']
```

Each word becomes a feature (column) in the TF-IDF matrix.

---

## Example

Suppose the dataset contains:

```text
"I hate you"
"You are awful"
```

The vocabulary may become:

```python
['hate', 'you', 'are', 'awful']
```

Each word receives a column index:

| Word | Column Index |
|------|---------------|
| hate | 0 |
| you | 1 |
| are | 2 |
| awful | 3 |

---

# 2. TF-IDF Matrix

The TF-IDF matrix represents the importance score of each vocabulary word inside each tweet.

Matrix structure:

| Dimension | Meaning |
|-----------|----------|
| Rows | Tweets/Documents |
| Columns | Vocabulary words |

Example:

```python
[[0.7, 0.0, 0.0, 0.5],
 [0.0, 0.3, 0.8, 0.0]]
```

This means:
- Row 1 corresponds to tweet 1
- Row 2 corresponds to tweet 2
- Each column corresponds to a vocabulary word

---

# 3. TF-IDF Formula

TF-IDF is computed using:

```math
TFIDF(t,d)=TF(t,d)\times IDF(t)
```

Where:

- \(TF(t,d)\) = frequency of term \(t\) inside document \(d\)
- \(IDF(t)\) = importance of the word across the dataset

---

# 4. Meaning of the Scores

A higher TF-IDF score means:
- the word appears frequently in the tweet
- the word is relatively rare across the dataset
- the word is therefore informative

A lower score means:
- the word is common
- less informative

---

# 5. Why Most Values Are Zero

The TF-IDF matrix is usually sparse.

This means most values are zero.

Example:

Tweet:

```text
"I hate you"
```

Vocabulary:

```python
['hate', 'banana', 'football']
```

TF-IDF vector:

```python
[0.8, 0.0, 0.0]
```

Explanation:
- `"hate"` appears in the tweet
- `"banana"` does not appear
- `"football"` does not appear

---

# 6. Sparse Matrix

Text datasets naturally produce sparse matrices because:
- vocabulary size is very large
- each tweet contains only a few words

Example:

- Vocabulary size = 20,000 words
- One tweet may contain only 10 words

Therefore:
- most columns become zero

This behavior is completely normal.

---

# 7. Importance for Hate Speech Detection

TF-IDF helps hate speech classifiers focus on informative words.

Example:

| Word | Expected TF-IDF |
|------|-----------------|
| the | low |
| is | low |
| hate | high |
| racist | high |

Offensive or discriminatory words often receive higher importance scores, improving classification performance.

---

# 8. Strange Tokens in Vocabulary

Example:

```python
'003' '007' '02'
```

These tokens indicate that:
- numbers
- IDs
- numeric strings

still exist in the dataset.

This usually means preprocessing can be improved.

---

# 9. Improving TF-IDF for Tweets

Better preprocessing can improve performance:

- remove URLs
- remove punctuation
- remove numbers
- remove stopwords
- normalize slang
- lowercase text

Example:

```python
TfidfVectorizer(
    stop_words='english',
    max_features=5000
)
```

---

# 10. Difference Between TF-IDF and Word Embeddings

TF-IDF and embeddings are different techniques.

## TF-IDF

- statistical representation
- measures word importance
- sparse vectors
- no semantic understanding

## Word2Vec / FastText

- dense embeddings
- capture semantic relationships
- contextual similarity
- learned representations

Both methods can be combined in NLP pipelines.

---

# Conclusion

The TF-IDF vocabulary contains all unique words extracted from the dataset, while the TF-IDF matrix stores the importance score of each word in every tweet.

The large number of zeros in the matrix is normal because text data is naturally sparse.

TF-IDF is highly useful for hate speech detection because it emphasizes informative and offensive words while reducing the influence of common terms.