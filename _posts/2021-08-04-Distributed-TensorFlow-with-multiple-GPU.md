---
layout: post
title: 使用多个GPU和服务器构建分布式TensorFlow
category: 计算机
tags: [计算机, 软件]
---


----------
有些神经网络模型太大了，无法放入单个设备(GPU)的内存中。这样的模型需要在许多设备上分离，在设备上并行地进行培训。这意味着任何人现在都可以使用TensorFlow将分布式培训扩展到100个GPU。但这并不是分布式TensorFlow的唯一优势，您还可以通过在许多GPU和服务器上并行运行许多实验来大量减少实验时间。而现在，我们将讨论分布式TensorFlow，并展示一些使用TensorFlow、GPU和多个服务器的方法。

## 使用TensorFlow和GPUs

我们将学习如何使用TensorFlow与GPU：执行的操作是一个简单的矩阵乘法，无论是在CPU或GPU。

### 准备工作

第一步是安装一个支持GPU的TensorFlow版本。你可以从[官方的TensorFlow安装说明][1]开始。记住，并且需要有一个通过CUDA或CuDNN支持GPU的环境。

### 怎么做...

按照下面的步骤进行：

- 首先导入几个模块

```
import sys
import numpy as np import tensorflow as tf
from datetime import datetime
```

- 从命令行获取你想要使用的处理单元类型(“GPU”或“CPU”)

```
device_name = sys.argv[1] # Choose device from cmd line. Options: gpu or cpu
shape = (int(sys.argv[2]), int(sys.argv[2])) if device_name == "gpu":
device_name = "/gpu:0" else:
device_name = "/cpu:0"
```

- 在GPU或CPU上执行矩阵乘法。关键指令使用tf.device(device_name)。它创建了一个新的上下文管理器，告诉TensorFlow在GPU或CPU上执行这些操作

```
with tf.device(device_name):
random_matrix = tf.random_uniform(shape=shape, minval=0, maxval=1) dot_operation = tf.matmul(random_matrix, tf.transpose(random_matrix)) sum_operation = tf.reduce_sum(dot_operation)
startTime = datetime.now()
with tf.Session(config=tf.ConfigProto(log_device_placement=True)) as session:
result = session.run(sum_operation) print(result)
```

- 打印一些调试计时只是为了验证CPU和GPU之间的区别

```
print("Shape:", shape, "Device:", device_name) print("Time taken:", datetime.now() - startTime)
```

### 它是如何工作的...

这个步骤解释了如何将TensorFlow计算分配给CPU或GPU。代码非常简单，它将作为下一个步骤的基础。

## 使用分布式TensorFlow：多个GPU和一个CPU

我们将展示一个数据并行的示例，其中数据在多个GPU上分割。

### 准备工作

这个步骤的灵感来自Neil Tenenholtz写的一个很好的博客，可以在网上找到：[https://clindatsci.com/blog/2017/5/31/distributed-tensorflow][2]

### 怎么做...

按照下面的步骤进行：

- 考虑在单个GPU上运行矩阵乘法的这段代码。

```
# single GPU (baseline) import tensorflow as tf
# place the initial data on the cpu with tf.device('/cpu:0'):
input_data = tf.Variable([[1., 2., 3.],
[4., 5., 6.],
[7., 8., 9.],
[10., 11., 12.]])
b = tf.Variable([[1.], [1.], [2.]])
 
# compute the result on the 0th gpu with tf.device('/gpu:0'):
output = tf.matmul(input_data, b)
 
# create a session and run with tf.Session() as sess:
sess.run(tf.global_variables_initializer()) print sess.run(output)
```

- 在下面的代码片段中，在2个不同的gpu之间使用图复制对代码进行分区。请注意，CPU充当主节点，分布图并收集最终结果。

```
# in-graph replication import tensorflow as tf num_gpus = 2
# place the initial data on the cpu with tf.device('/cpu:0'):
input_data = tf.Variable([[1., 2., 3.],
[4., 5., 6.],
[7., 8., 9.],
[10., 11., 12.]])
b = tf.Variable([[1.], [1.], [2.]])
 
# split the data into chunks for each gpu inputs = tf.split(input_data, num_gpus) outputs = []
 
# loop over available gpus and pass input data for i in range(num_gpus):
with tf.device('/gpu:'+str(i)): outputs.append(tf.matmul(inputs[i], b))
 
# merge the results of the devices with tf.device('/cpu:0'):
output = tf.concat(outputs, axis=0)
 
# create a session and run with tf.Session() as sess:
sess.run(tf.global_variables_initializer()) print sess.run(output)
```

### 它是如何工作的...

这是一个非常简单的方法，图被分成两部分，CPU作为主CPU，分布到两个作为分布式工作CPU的GPU。计算的结果被收集回CPU。

## 使用分布式TensorFlow：多台服务器

我们将学习如何在多个服务器上分布TensorFlow计算。关键的假设是工人（以下简称worker）和参数服务器（以下简称PS）的代码是相同的。因此，每个计算节点的角色是通过命令行参数传递的。

### 准备工作

同样，这个步骤的灵感还是来自Neil Tenenholtz的那个博文：[https://clindatsci.com/blog/2017/5/31/distributed-tensorflow][3]

### 怎么做...

按照下面的步骤进行：

- 考虑下面这段代码，其中我们指定了一个运行在192.168.1.2:1111上的主服务器和两个分别运行在192.168.1.2:1111和192.168.1.3:1111上的worker集群架构

```
import sys
import tensorflow as tf

# specify the cluster's architecture

cluster = tf.train.ClusterSpec({'ps': ['192.168.1.1:1111'], 'worker': ['192.168.1.2:1111',

'192.168.1.3:1111']

})
```

- 请注意，代码是在多台机器上复制的，因此了解当前执行节点的角色非常重要。我们从命令行获取这些信息。一台机器可以是一个worker或一个PS

```
# parse command-line to specify machine

job_type = sys.argv[1] # job type: "worker" or "ps" task_idx = sys.argv[2] # index job in the worker or ps list

# as defined in the ClusterSpec
```

- 运行给定集群的培训服务器，我们为每个计算者提供一个角色(worker或ps)和一个id

```
# create TensorFlow Server. This is how the machines communicate.

server = tf.train.Server(cluster, job_name=job_type, task_index=task_idx)
```

- 计算根据具体计算节点的作用而不同：如果角色是PS，则条件是加入服务器。注意，在这种情况下没有代码要执行，因为worker将不断地推送更新，而PS必须做的唯一事情就是等待。否则，工作代码将在集群内的特定设备上执行。这部分代码类似于在单个机器上执行的代码，我们首先构建模型，然后在本地训练它。注意，所有工作的分发和更新结果的收集都是由Tensoflow透明地完成的。注意，TensorFlow提供了一个方便的tf.train。自动为设备分配操作的Replica_device_setter

```
# parameter server is updated by remote clients.
# will not proceed beyond this if statement. if job_type == 'ps':
server.join() else:
# workers only
with tf.device(tf.train.replica_device_setter( worker_device='/job:worker/task:'+task_idx, cluster=cluster)):
# build your model here as if you only were using a single machine
 
with tf.Session(server.target):
# train your model here
```

### 它是如何工作的...

我们已经看到了如何创建具有多个计算节点的集群。一个节点可以扮演PS的角色，也可以扮演worker的角色。

在这两种情况下，执行的代码是相同的，但根据从命令行收集的参数，执行的代码是不同的。PS只需要等待，直到worker发送更新。注意，tf.train.replica_device_setter(..)的作用是自动为可用设备分配操作，而tf.train.ClusterSpec(..)用于集群设置。

### 还有更多...

网上有[MNIST分散式训练][4]的一个例子。此外，出于效率考虑，您可以决定使用多个PS。使用PS可以提供更好的网络利用率，并且允许将模型扩展到更多的并行机器。可以分配多个PS。有兴趣的读者可以在[这里][5]看看。

## 训练分布式TensorFlow的MNIST分类器

在这篇文章中，我们以分布式的方式训练了一个完整的MNIST分类器。这个方法的灵感来自http://ischlag.github.io/2016/06/12/async-distributed- tensorflow/的一篇博客文章，在tensorflow 1.2上运行的代码可以在https://github.com/ischlag/distributed-tensorflow-example中找到。

### 准备工作

这个步骤是基于前一个步骤。所以按顺序来读可能比较方便。

### 怎么做...

按照下面的步骤进行：

- 导入一些标准模块并定义运行计算的TensorFlow集群。然后为特定的任务启动服务器

```
import tensorflow as tf import sys
import time
# cluster specification parameter_servers = ["pc-01:2222"] workers = [ "pc-02:2222",
"pc-03:2222",
"pc-04:2222"]
cluster = tf.train.ClusterSpec({"ps":parameter_servers, "worker":workers})
# input flags
tf.app.flags.DEFINE_string("job_name", "", "Either 'ps' or 'worker'") tf.app.flags.DEFINE_integer("task_index", 0, "Index of task within the job")FLAGS = tf.app.flags.FLAGS
# start a server for a specific task server = tf.train.Server(
cluster, job_name=FLAGS.job_name, task_index=FLAGS.task_index)
```

- 读取MNIST数据并定义用于训练的超级参数

```
# config batch_size = 100

learning_rate = 0.0005

training_epochs = 20 logs_path = "/tmp/mnist/1"

# load mnist data set

from tensorflow.examples.tutorials.mnist import input_data mnist = input_data.read_data_sets('MNIST_data', one_hot=True)
```

- 检查您的角色是PS还是Worker。如果worker定义一个简单的密集神经网络，定义一个优化器，以及用于评估分类器的度量(例如准确性)

```
if FLAGS.job_name == "ps": server.join()
elif FLAGS.job_name == "worker":
# Between-graph replication
with tf.device(tf.train.replica_device_setter( 
worker_device="/job:worker/task:%d" % FLAGS.task_index, cluster=cluster)):
# count the number of updates
global_step = tf.get_variable( 'global_step', [], initializer = tf.constant_initializer(0),
trainable = False)
 
# input images
with tf.name_scope('input'):
# None -> batch size can be any size, 784 -> flattened mnist image x = tf.placeholder(tf.float32, shape=[None, 784], name="x-input")
# target 10 output classes
y_ = tf.placeholder(tf.float32, shape=[None, 10], name="y-input")
 
# model parameters will change during training so we use tf.Variable tf.set_random_seed(1)
with tf.name_scope("weights"):
W1 = tf.Variable(tf.random_normal([784, 100])) W2 = tf.Variable(tf.random_normal([100, 10]))
 
# bias
with tf.name_scope("biases"):
b1 = tf.Variable(tf.zeros([100])) b2 = tf.Variable(tf.zeros([10]))
 
# implement model
with tf.name_scope("softmax"):
# y is our prediction
z2 = tf.add(tf.matmul(x,W1),b1) a2 = tf.nn.sigmoid(z2)
z3 = tf.add(tf.matmul(a2,W2),b2) y = tf.nn.softmax(z3)
 
# specify cost function
with tf.name_scope('cross_entropy'):
# this is our cost cross_entropy = tf.reduce_mean(
-tf.reduce_sum(y_ * tf.log(y), reduction_indices=[1]))
 
# specify optimizer
with tf.name_scope('train'):
# optimizer is an "operation" which we can execute in a session grad_op = tf.train.GradientDescentOptimizer(learning_rate)
train_op = grad_op.minimize(cross_entropy, global_step=global_step)
 
with tf.name_scope('Accuracy'):
# accuracy
correct_prediction = tf.equal(tf.argmax(y,1), tf.argmax(y_,1))
 
accuracy = tf.reduce_mean(tf.cast(correct_prediction, tf.float32))
 
# create a summary for our cost and accuracy tf.summary.scalar("cost", cross_entropy) tf.summary.scalar("accuracy", accuracy)
# merge all summaries into a single "operation" which we can execute in a session
summary_op = tf.summary.merge_all()
init_op = tf.global_variables_initializer() print("Variables initialized ...")
```

- 启动一个监控器，作为分布式设置的主要机器。chief是管理集群其余部分的工作机器。会话由主管维护，关键指令是sv = tf.train.Supervisor(is_chief=(FLAGS. FLAGS) .)task_index = = 0))。此外，使用prepare_or_wait_for_session(server.target)，管理器将等待模型准备好使用。请注意，每个worker将负责不同的批处理模型，最终模型将供主管使用

```
sv = tf.train.Supervisor(is_chief=(FLAGS.task_index == 0), begin_time = time.time()
frequency = 100
with sv.prepare_or_wait_for_session(server.target) as sess:
# create log writer object (this will log on every machine)
writer = tf.summary.FileWriter(logs_path, graph=tf.get_default_graph())
# perform training cycles start_time = time.time()
for epoch in range(training_epochs):
# number of batches in one epoch
batch_count = int(mnist.train.num_examples/batch_size) count = 0
for i in range(batch_count):
batch_x, batch_y = mnist.train.next_batch(batch_size)
# perform the operations we defined earlier on batch
_, cost, summary, step = sess.run(
[train_op, cross_entropy, summary_op, global_step], feed_dict={x: batch_x, y_: batch_y}) writer.add_summary(summary, step)
count += 1
if count % frequency == 0 or i+1 == batch_count: elapsed_time = time.time() - start_time start_time = time.time()
print("Step: %d," % (step+1),
" Epoch: %2d," % (epoch+1), " Batch: %3d of %3d," % (i+1, batch_count),
" Cost: %.4f," % cost, 
"AvgTime:%3.2fms" % float(elapsed_time*1000/frequency)) count = 0
print("Test-Accuracy: %2.2f" % sess.run(accuracy, feed_dict={x: mnist.test.images, y_: mnist.test.labels}))
print("Total Time: %3.2fs" % float(time.time() - begin_time)) print("Final Cost: %.4f" % cost)
sv.stop()
print("done")
```

### 它如何工作...

本步骤描述了一个分布式MNIST分类器的示例。在本例中，TensorFlow允许我们定义三台机器的集群。一台作为PS，另外两台作为worker处理不同批次的训练数据。


  [1]: https://www.tensorflow.org/
  [2]: https://clindatsci.com/blog/2017/5/31/distributed-tensorflow
  [3]: https://clindatsci.com/blog/2017/5/31/distributed-tensorflow
  [4]: https://github.com/%20ischlag/distributed-tensorflow-example/blob/master/example.py
  [5]: https://www.tensorflow.org/deploy/%20distributed