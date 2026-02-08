# Bakytzhan.dev – Math + Tech Portfolio

Hello, I’m **Bakytzhan**. I build interactive math tools, data-driven apps, and creative visualizations. My focus is turning complex ideas into intuitive experiences.

## Quick Profile
- Student developer • Math enthusiast • Frontend & Python  
- Currently exploring: visualization, interactive learning, and algorithms

## Projects

### Quadratic Visualizer
Interactive tool to solve and graph quadratic equations with real-time updates.  
[GitHub link]

### Prime Explorer
Check primes, factor numbers, and visualize patterns in the number line.  
[GitHub link]

### Golden Ratio Lab
Generate Fibonacci sequences and explore golden ratio convergence.  
[GitHub link]

### Interactive Math Lab
- MathJax renders formulas cleanly  
- PyScript runs Python in the browser

**Example: Fibonacci numbers (PyScript)**
```python
def fib(n): 
    a, b = 0, 1
    out = [a, b]
    for _ in range(2, n):
        a, b = b, a + b
        out.append(b)
    return out
print("Fibonacci (10 terms):", fib(10))
